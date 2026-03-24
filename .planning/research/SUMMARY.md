# Project Research Summary

**Project:** Streaming Chatbot
**Domain:** Next.js App Router + Vercel AI SDK + OpenAI + Drizzle ORM + Postgres
**Researched:** 2025-07-14
**Confidence:** HIGH

## Executive Summary

This is a streaming chatbot with persistent conversation history — essentially a scoped ChatGPT clone. The Vercel AI SDK (`ai@6.x`) handles the hard streaming plumbing: `streamText` on the server and `useChat` on the client cover token-by-token SSE delivery, multi-turn message management, loading/error states, and the stop-generation flow with zero custom code. What remains as custom work is the persistence layer (Drizzle + Postgres), the conversation routing (`/chat/[chatId]`), and the sidebar UI.

The recommended architecture is a Next.js 16 App Router project with three external dependencies: OpenAI (via `@ai-sdk/openai`), Postgres (via `drizzle-orm` + `postgres` driver), and the Vercel AI SDK. Streaming works via Route Handler → `streamText().toDataStreamResponse()` → `useChat`. Persistence uses a two-phase pattern: save the user message at the top of the Route Handler before calling the LLM, then save the assistant response in `streamText`'s `onFinish` callback server-side. Never save from the client.

The single biggest risk is the persistence integration: there are five distinct failure modes in the streaming + DB write path that each manifest as silent data loss. All five are well-understood and preventable — but only if addressed deliberately during Phase 2. The second risk is import path confusion across the three AI SDK packages (`ai`, `ai/react`, `@ai-sdk/openai`), which must be locked in Phase 1 before any feature code is written.

## Key Findings

### Recommended Stack

The AI SDK is split across three packages that must be installed separately and imported from distinct paths. Mixing them causes silent runtime failures. The `postgres` driver is preferred over `pg` for ESM-native serverless compatibility. Drizzle `0.45.1` is the stable release — the `1.0.0-beta` track is not production-ready.

**Core technologies (exact versions):**
- `next@16.2.1` — App Router, Route Handlers, Server Components; streaming requires App Router (`toDataStreamResponse()` is incompatible with Pages Router)
- `react@19.2.4` / `react-dom@19.2.4` — default peer dep for Next.js 16
- `ai@6.0.137` — server-side: `streamText`, `generateText`, `generateObject`
- `@ai-sdk/react@3.0.139` — client-side: `useChat`, `useCompletion` (separate package, separate import)
- `@ai-sdk/openai@3.0.48` — OpenAI provider factory; reads `OPENAI_API_KEY` from env automatically
- `drizzle-orm@0.45.1` — TypeScript-native ORM; SQL-like core API for CRUD, Query API for joins
- `postgres@3.4.8` — Postgres driver (not `pg`); ESM-native, serverless-friendly
- `zod@4.3.6` — required peer dep of `ai`; used for env var and API input validation
- `drizzle-kit@0.31.10` (dev) — migration generation, `drizzle-kit generate` + `migrate` + `studio`

**Installation:**
```bash
npm install next@16.2.1 react@19.2.4 react-dom@19.2.4
npm install ai@6.0.137 @ai-sdk/react@3.0.139 @ai-sdk/openai@3.0.48
npm install drizzle-orm@0.45.1 postgres@3.4.8 zod@4.3.6
npm install -D drizzle-kit@0.31.10 typescript@6.0.2 dotenv
```

**Environment variables:**
```bash
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost:5432/chatdb
```

**Model default:** `openai('gpt-4o-mini')` — swap to `openai('gpt-4o')` by changing only the string.

See [STACK.md](./STACK.md) for full alternatives analysis and version compatibility matrix.

---

### Expected Features

`useChat` is the multiplier: it ships streaming output, multi-turn context, input state, loading/error flags, and stop/reload functions for free. The custom work is persistence, routing, and the sidebar.

**Must have — v1 launch (demo fails without these):**
- Streaming output — `useChat` + `streamText` handle this automatically; just wire up the Route Handler
- Send/receive messages — `useChat` provides `handleSubmit`, `input`, `handleInputChange`
- Multi-turn context — `useChat` sends the full `messages` array on every request; pass it through to `streamText`
- Cross-session persistence — requires custom DB writes; most complex item in v1; see two-phase pattern in Architecture
- Conversation list sidebar — DB query for all chats + sidebar component + routing to `/chat/[chatId]`
- New chat creation — insert row, redirect to `/chat/<id>`; no client JS needed
- Load existing chat — fetch messages server-side, pass as `initialMessages` to `useChat`
- Loading indicator — `useChat` exposes `isLoading`; wire to a spinner or disabled input
- Error states — `useChat` exposes `error`; must display it — a blank screen on API failure kills a demo

**Should have — v1.x (add once core loop is stable):**
- Markdown rendering — `react-markdown` + `remark-gfm`; render plain text during streaming, switch to markdown on `isLoading === false` to avoid parse flicker
- Code syntax highlighting — `react-syntax-highlighter` inside a custom `code` component in `react-markdown`
- Stop generation — `useChat.stop()` wired to a button visible while `isLoading`; implement `onAbort` on the server to avoid unhandled errors
- Copy message button — Clipboard API; ~15 lines; hover-reveal; no backend

**Defer — v2+ only:**
- Auto-title from first message — extra LLM call (`generateText`) adds latency; substring truncation is an acceptable interim
- Model switcher — needs a DB column on chats, UI selector, and `body` option in `useChat`
- Regenerate response — `useChat.reload()` works client-side but requires careful DB sync (delete old assistant message, insert new one)
- Keyboard shortcuts, conversation rename, scroll-to-bottom auto-scroll — polish; not blocking v1

**Explicitly out of scope:**
- Auth/user accounts, file uploads, voice I/O, multi-tab sync, conversation branching

See [FEATURES.md](./FEATURES.md) for dependency graph, hidden complexity flags, and the full prioritization matrix.

---

### Architecture Approach

The system has three layers: a Next.js App Router front-end with Server Components loading chat history from Postgres, a Route Handler that calls OpenAI via `streamText` and persists via `onFinish`, and a Drizzle DB layer (`lib/db/`) shared between both. Client components own `useChat` and never touch the DB directly.

**Request flow (one chat turn):**
```
useChat.handleSubmit()
  → optimistic UI update (instant)
  → POST /api/chat { messages, chatId }
      → Route Handler saves user message to DB (pre-LLM)
      → streamText({ model, messages, onFinish })
          → OpenAI API streams tokens back
      → result.toDataStreamResponse() (SSE to client)
          → useChat renders tokens as they arrive
      → onFinish fires server-side after last token
          → saves assistant message to DB
          → updates chat.updatedAt + title
  → router.refresh() after 300ms to sync sidebar
```

**Major components:**
1. `app/api/chat/route.ts` — streaming Route Handler; `streamText` + `toDataStreamResponse`; two-phase persistence in `onFinish`
2. `components/ChatInterface.tsx` (`"use client"`) — owns `useChat`; accepts `chatId` + `initialMessages` props; passes `chatId` in `useChat`'s `body` option
3. `components/MessageList.tsx` (`"use client"`) — renders `messages` from `useChat`; streaming-aware display
4. `app/chat/[chatId]/page.tsx` (Server Component) — fetches chat + messages from DB, passes as `initialMessages`
5. `app/layout.tsx` — root layout with sidebar slot; sidebar re-fetches on route change via layout re-render
6. `lib/db/` — three files: `index.ts` (singleton Drizzle client), `schema.ts` (table definitions), `queries.ts` (typed CRUD functions)

**Schema (two tables):**
```sql
chats    (id TEXT PK, title TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
messages (id TEXT PK, chat_id TEXT FK→chats CASCADE, role TEXT, content TEXT, created_at TIMESTAMPTZ)
-- Index: messages_chat_id_idx ON messages(chat_id)
```

Use `text` IDs (nanoid/`crypto.randomUUID()`) — client can generate IDs before server confirms, enabling optimistic inserts. Generate IDs server-side in `onFinish` for assistant messages, never trust client-provided IDs.

**Key implementation rules:**
- Import `streamText` from `"ai"`, `useChat` from `"ai/react"`, provider from `"@ai-sdk/openai"` — never mix
- Call `result.toDataStreamResponse()` immediately; never `await result.text` before returning
- Use `onFinish` for all persistence — never save mid-stream or from client
- Singleton Drizzle client via `globalThis` guard — prevents connection exhaustion during hot reloads
- `export const dynamic = "force-dynamic"` on the Route Handler — prevents Next.js caching buffering the stream

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full file structure, all three architecture patterns with code examples, edge cases, anti-patterns, and the complete build order.

---

### Critical Pitfalls

These are the failure modes most likely to cost time on a 1-week timeline. Each has a definitive fix.

1. **Wrong import paths** — `streamText` comes from `"ai"`, `useChat` from `"ai/react"`, the provider from `"@ai-sdk/openai"`. Importing `useChat` from `"ai"` or `streamText` from `"ai/react"` fails silently or at runtime. Lock all three imports in Phase 1 and don't deviate.

2. **`StreamingTextResponse` is removed** — Any tutorial or blog post from before 2024 uses `new StreamingTextResponse(result.textStream)`. This was deleted in AI SDK v4. The correct pattern is `result.toDataStreamResponse()`. Grep for `StreamingTextResponse` and treat any result as a build-blocker.

3. **Saving assistant message before stream ends** — Calling `await result.text` or inserting to DB before calling `toDataStreamResponse()` causes the promise to hang indefinitely (confirmed SDK issue #5438). All DB persistence for the assistant message must go inside the `onFinish` callback — this fires exactly once after the last token.

4. **Not persisting the user message before the LLM call** — If OpenAI fails after the request arrives, the user's message is never saved. The conversation history becomes inconsistent. Save the user message as the first line of the Route Handler, before calling `streamText`.

5. **Silent DB write failure in `onFinish`** — The stream already returned `200 OK` before `onFinish` runs. If the DB insert throws, the error is swallowed — message lost, no visible failure. Wrap `onFinish` DB writes in try/catch with explicit logging. For demo scope, log and accept rare loss; for production, add a 3-attempt retry with exponential backoff.

6. **`drizzle-kit push` leaves no migration history** — `push` syncs the schema instantly but creates no migration files. Anyone cloning the repo gets a broken DB. Establish `drizzle-kit generate` + `drizzle-kit migrate` as the only workflow from Day 1. Commit the `drizzle/` migrations directory.

7. **Drizzle singleton not set up — connection exhaustion** — Next.js hot reload re-evaluates modules. A bare `drizzle(new Pool(...))` at module scope creates a new connection pool on every reload. After 15 minutes of development the DB hits its connection limit. Use the `globalThis` singleton pattern from the first line of `lib/db/index.ts`.

8. **Route handler buffering instead of streaming** — Missing `export const dynamic = "force-dynamic"` allows Next.js to cache the Route Handler response, delivering it as a single chunk. Verify in DevTools Network tab that `Transfer-Encoding: chunked` is present and the first token arrives within ~1 second before building any UI on top of it.

9. **Stream leaking across chat navigation** — When the user switches chats while a response is streaming, `useChat` does not abort the previous stream (SDK issue #13304). Tokens from chat A appear in chat B. Fix with a `useEffect` cleanup that calls `stop()` when `chatId` changes or the component unmounts.

10. **`onAbort` not handled for stop button** — `useChat.stop()` aborts the fetch mid-stream, bypassing `onFinish`. Without an `onAbort` callback on the server, the abort throws an unhandled `ResponseAborted` error. For demo scope: implement `onAbort` with a `console.log` to keep logs clean; partial response loss on user-initiated stop is acceptable.

See [PITFALLS.md](./PITFALLS.md) for the full 14-pitfall catalog with code examples, warning signs, and a phase-to-pitfall prevention mapping.

---

## Implications for Roadmap

### Phase 1: Foundation + DB Setup (Day 1)
**Rationale:** Everything downstream depends on a working DB connection and correct package setup. Import path bugs and connection pool bugs are the cheapest to fix at day zero and the most expensive to discover on day five.
**Delivers:** Next.js app boots; Drizzle connects to Postgres; first migration committed; singleton DB client in place.
**Avoids:** Pitfalls 1 (wrong imports), 2 (deprecated API), 6 (push-only migrations), 7 (connection exhaustion), 12 (edge runtime).
**Actions:**
- `npx create-next-app` with App Router + TypeScript + strict mode
- Install all packages at exact versions listed above
- Create `lib/db/index.ts` with `globalThis` singleton pattern immediately
- Write `lib/db/schema.ts` (`chats` + `messages` tables with index)
- Run `drizzle-kit generate` + `drizzle-kit migrate`; commit the `drizzle/` directory
- Smoke test: log a DB query from a Server Component
- Add `export const dynamic = "force-dynamic"` to the Route Handler file (create stub)
**Research flags:** None — all patterns are well-documented and verified.

### Phase 2: Streaming + Persistence Core (Days 2–3)
**Rationale:** The streaming + persistence integration is the highest-risk work in the project. All five persistence failure modes live here. Building it before the full UI means failures are visible and debuggable without UI noise. Verify streaming works end-to-end (DevTools Network chunked) before adding any polish.
**Delivers:** Route Handler streams tokens to `useChat`; user and assistant messages persist to DB; reload shows history.
**Implements:** Route Handler with two-phase persistence, `useChat` wired to Route Handler, `initialMessages` loading from DB.
**Avoids:** Pitfalls 3 (save before stream), 4 (user message not saved), 5 (silent DB failure), 8 (buffered response), 10 (abort not handled).
**Actions:**
- `app/api/chat/route.ts`: `streamText` + `toDataStreamResponse`; save user message before `streamText` call; save assistant in `onFinish` with try/catch
- `lib/db/queries.ts`: `createChat`, `getChats`, `getChat`, `getMessages`, `saveMessages`, `updateChat`, `deleteChat`
- Basic `ChatInterface` with `useChat`; hardcode `chatId` temporarily
- Verify DevTools shows `Transfer-Encoding: chunked` and first token < 1s
- Reload test: all messages (user + assistant) present in DB after conversation
**Research flags:** None — two-phase persistence pattern is documented and verified.

### Phase 3: UI + Routing (Days 3–4)
**Rationale:** With a proven streaming + persistence core, build the UI shell. Dynamic routing (`/chat/[chatId]`) must be wired before the sidebar becomes functional — it is a hard dependency for navigation.
**Delivers:** Full chat UI; conversation list sidebar; new chat creation; load existing chat; loading indicator; error states.
**Implements:** App Router dynamic segments, `initialMessages` prop flow, Server Component data loading, `router.refresh()` for sidebar sync.
**Avoids:** Pitfall 9 (stream leak on chat switch — add `useEffect` cleanup), Pitfall 10 (hydration mismatch — generate IDs server-side).
**Actions:**
- `app/layout.tsx`: sidebar slot + main slot
- `app/page.tsx`: `createChat()` → `redirect('/chat/<id>')`
- `app/chat/[chatId]/page.tsx`: Server Component; fetch chat + messages; pass `initialMessages`
- `components/ChatInterface.tsx`: accept `chatId` + `initialMessages`; pass `chatId` in `useChat`'s `body`; add `useEffect` cleanup for stop on chat switch
- `components/MessageList.tsx`, `MessageInput.tsx`: render messages; disable input during `isLoading`; show `error` state
- `components/Sidebar.tsx`: Server Component fetching `getChats()`; active chat highlight; `router.refresh()` after new chat
- Auto-title: derive from first user message substring in `onFinish`; call `updateChat`
**Research flags:** None — App Router patterns are standard.

### Phase 4: Polish + Demo Hardening (Days 5–7)
**Rationale:** Once the core loop (create → chat → persist → reload) is verified end-to-end, add the features that make the demo feel complete and handle the failure modes a live demo is likely to hit.
**Delivers:** Markdown + syntax highlighting; stop button; copy message; auto-scroll; graceful error display; delete chat.
**Avoids:** UX pitfalls (no loading indicator, no stop button, markdown as raw text), retry and error handling gaps.
**Actions:**
- Markdown rendering: `react-markdown` + `remark-gfm`; render plain text during streaming, markdown after `isLoading === false`
- Code highlighting: `react-syntax-highlighter` in custom `code` component
- Stop button: visible when `isLoading`; calls `useChat.stop()`; server-side `onAbort` logs the abort
- Copy message: hover-reveal clipboard button; ~15 lines
- Auto-scroll: `useEffect` + `ref` on message list; suppress when user scrolls up
- Error handling: display `useChat.error` inline in the chat thread
- Delete chat: DB delete (cascade handles messages); sidebar refresh
- Pre-demo checklist: DevTools streaming verification, reload test, multi-chat isolation, fresh-clone setup test

### Phase Ordering Rationale

- **DB before UI:** The entire feature tree for persistence (list, load, rename, auto-title) is blocked until Drizzle schema and migrations exist. Building UI first creates throwaway state management that gets ripped out when the real DB is wired.
- **Streaming verified before persistence added:** Writing to DB on top of a broken stream is debugging two systems at once. Confirm `Transfer-Encoding: chunked` in DevTools first.
- **Routing before sidebar:** The sidebar renders links to `/chat/[chatId]` — the dynamic segment must exist before any sidebar link is functional.
- **Polish last:** Markdown flicker, auto-scroll edge cases, and copy button UX are easy to add to a working core and impossible to debug on a broken one.

### Research Flags

Phases with well-documented, verified patterns (no additional research needed):
- **Phase 1:** Next.js + Drizzle setup is extensively documented; all versions verified against live npm registry
- **Phase 2:** Two-phase persistence pattern is the official Vercel AI SDK cookbook recommendation; pitfalls are from confirmed GitHub issues with known fixes
- **Phase 3:** App Router dynamic routes and Server Component patterns are stable and well-documented
- **Phase 4:** `react-markdown` + `react-syntax-highlighter` are standard libraries with established patterns

No research flags — all patterns have HIGH confidence sourced from official docs and verified SDK issues.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against live npm registry; API patterns verified against current official docs |
| Features | HIGH | `useChat` API surface verified; persistence failure modes sourced from confirmed SDK GitHub issues |
| Architecture | HIGH | Route Handler + `streamText` + `onFinish` pattern is the canonical Vercel AI SDK cookbook example |
| Pitfalls | HIGH | Each pitfall traced to a specific GitHub issue, migration guide, or reproducible bug report |

**Overall confidence:** HIGH

### Gaps to Address

- **`onAbort` partial message recovery:** For demo scope, accepting partial response loss on user stop is fine. If requirements change to require partial persistence, this needs a separate investigation — the `text` content is not available inside `onAbort` and requires a shared-variable workaround.
- **Connection pooling for hosted Postgres:** The singleton pattern is documented for local Postgres. If the target is Neon or Supabase, the pooled connection string format differs (`?pgbouncer=true` for Neon). Validate `DATABASE_URL` format against the chosen provider before Phase 1.
- **OpenAI rate limits under demo load:** No rate limiting is implemented. For a single-user demo this is acceptable. If the demo involves multiple simultaneous users, add IP-based rate limiting at the Route Handler before any public exposure.

---

## Sources

### Primary (HIGH confidence)
- https://ai-sdk.dev/docs/getting-started/nextjs-app-router — canonical quickstart; `useChat` + `streamText` + `toDataStreamResponse` pattern
- https://sdk.vercel.ai/cookbook/next/save-messages-to-database — two-phase persistence pattern (official cookbook)
- https://ai-sdk.dev/docs/migration-guides/migration-guide-4-0 — `StreamingTextResponse` removal, `convertToCoreMessages` deprecation, `baseUrl` → `baseURL`
- https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text — `streamText` options, `onFinish`, `onAbort`
- https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat — `useChat` full API surface
- https://orm.drizzle.team/docs/schemas — Drizzle table definitions, migrations
- `npm view ai dist-tags` — verified `ai@6.0.137` is `latest`; all package versions confirmed live

### Secondary (HIGH confidence — confirmed GitHub issues)
- https://github.com/vercel/ai/issues/5438 — `streamText` promise hangs if stream not consumed before `.text`
- https://github.com/vercel/ai/issues/5459 — stop button causes `ResponseAborted` bypassing `onFinish`
- https://github.com/vercel/ai/issues/13304 — `useChat` id change does not abort previous stream
- https://github.com/vercel/ai/issues/9307 — `onFinish` message access; user message must be saved separately
- https://github.com/vercel/ai-chatbot/pull/404 — race condition fix: sidebar refresh before DB write commits

### Tertiary (MEDIUM confidence — community / blog)
- https://athrael.net/blog/building-an-ai-chat-assistant/add-markdown-to-streaming-chat — markdown + streaming flicker mitigation
- https://www.oreateai.com/blog/drizzle-push-vs-migrate-navigating-database-management-with-drizzle-kit — push vs migrate distinction

---
*Research completed: 2025-07-14*
*Ready for roadmap: yes*
