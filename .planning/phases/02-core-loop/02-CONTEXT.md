# Phase 2: Core Loop - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the streaming send/receive/persist loop: user sends a message, the assistant response streams token-by-token in the browser, all messages are persisted to Postgres, and transient LLM failures are retried automatically. This phase ends with a working, testable chat interface at a single route. The sidebar, conversation list, and conversation management belong to Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Message Appearance
- **D-01:** ChatGPT-style aligned bubbles — user messages right-aligned with a gray background, assistant messages left-aligned with a white/light background. No avatars required — alignment alone differentiates the two roles.
- **D-02:** Tailwind utility classes only — no custom CSS files or CSS-in-JS. Keep it minimal; this is Phase 2, not Phase 3 polish.

### Loading & Error Feedback
- **D-03:** While the assistant is responding, show pulsing dots (or equivalent animated indicator) rendered as a message bubble in the thread — not a spinner outside the thread, not a disabled-input-only indicator. The animation lives in the message area where the response will appear.
- **D-04:** Errors (exhausted retries) are displayed as an inline error bubble inside the chat thread — not a toast, not a banner, not below the input. The error appears where the response would have been, making it scannable in the conversation history.
- **D-05:** Input (`MessageInput`) is disabled while `isLoading` is true. The submit button reflects the same disabled state.

### Phase 2 Chat Access (Root Page)
- **D-06:** The root `app/page.tsx` gets a minimal "Start Chat" button. Clicking it creates a new chat row in the DB and redirects to `/chat/<id>`. This is a working stub — it will be replaced/extended by Phase 3's full `app/page.tsx` (auto-create + redirect logic). For Phase 2, a button is sufficient to give a real test path without requiring the full Phase 3 shell.
- **D-07:** The `/chat/[chatId]/page.tsx` route is the primary test surface. It is a Server Component that fetches messages from Postgres and passes them as `initialMessages` to `ChatInterface`.

### Claude's Discretion
- Exact pulsing dots animation (CSS keyframes, Tailwind `animate-pulse`, or a third-party component — keep it simple)
- Whether `MessageInput` uses a `<textarea>` or `<input type="text">` — either is fine for Phase 2
- Exact Tailwind color choices for message bubbles (e.g., `bg-gray-100` vs `bg-gray-200` for user, `bg-white` for assistant)
- Whether the loading indicator is a separate `LoadingMessage` component or a conditional inside `MessageList`
- Retry implementation library vs manual (e.g., a small hand-rolled exponential backoff loop is fine; no need for `p-retry` or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack versions & API surface
- `.planning/research/STACK.md` — Pinned versions for all packages; critical note: `toUIMessageStreamResponse()` (not `toDataStreamResponse()`) is the correct ai@6.x API already confirmed in the route stub.

### Architecture patterns
- `.planning/research/ARCHITECTURE.md` — Canonical component breakdown (`ChatInterface`, `MessageList`, `MessageInput`), the `useChat` + `initialMessages` pattern, `onFinish` for assistant persistence, and the full request/data flow diagram.

### Critical pitfalls for Phase 2
- `.planning/research/PITFALLS.md` §Pitfall 3 — Save assistant message in `onFinish`, never before the stream completes.
- `.planning/research/PITFALLS.md` §Pitfall 4 — Persist user message BEFORE calling the LLM (two-phase commit pattern).
- `.planning/research/PITFALLS.md` §Pitfall 5 — Wrap `onFinish` DB write in try/catch with explicit error logging; silent failures are unacceptable.
- `.planning/research/PITFALLS.md` §Pitfall 6 — Retry the LLM call only for pre-stream errors; never retry the LLM call when the DB write fails in `onFinish`.

### Existing Phase 1 output (integration points)
- `src/app/api/chat/route.ts` — Route Handler stub with correct imports already locked: `streamText` from `"ai"`, `openai` from `"@ai-sdk/openai"`, `toUIMessageStreamResponse()`. Phase 2 fills this out.
- `src/lib/db/schema.ts` — `chats` and `messages` table definitions; `Chat`, `Message`, `NewMessage` inferred types available.
- `src/lib/db/index.ts` — Drizzle client singleton (`db`), import via `@/lib/db`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/schema.ts` — `chats` and `messages` tables + inferred TypeScript types (`Chat`, `Message`, `NewMessage`) ready to use in `queries.ts`.
- `src/lib/db/index.ts` — `db` client singleton already implements the `globalThis` guard; import and use directly.
- `src/app/api/chat/route.ts` — Correct stub: `streamText`, `openai('gpt-4o-mini')`, `toUIMessageStreamResponse()`, `export const dynamic = 'force-dynamic'`. Phase 2 adds `chatId` extraction, user message persistence, `onFinish`, and retry wrapper.

### Established Patterns
- **ID generation:** `crypto.randomUUID()` — established in Phase 1, no `nanoid`.
- **Import aliases:** `@/lib/db`, `@/components/*`, `@/lib/db/queries` — all via `@/*` alias set in `tsconfig.json`.
- **Styling:** Tailwind v4 via `@tailwindcss/postcss`; no `tailwind.config.ts`; add classes directly. `globals.css` and root `layout.tsx` already wired.
- **Client Components:** Use `"use client"` directive for anything that uses `useChat`, event handlers, or browser APIs.

### Integration Points
- `src/app/page.tsx` — Currently a DB smoke test; Phase 2 replaces it with a minimal "Start Chat" button + Server Action (or Route Handler) to create a chat and redirect.
- `src/app/chat/[chatId]/page.tsx` — **New file** in Phase 2. Server Component: fetches chat + messages from DB, passes `initialMessages` to `ChatInterface`.
- `src/app/layout.tsx` — Root layout exists (Geist font, `min-h-full flex flex-col`). Phase 2 does not restructure this; Phase 3 adds the sidebar slot.
- `src/components/` — **New directory** in Phase 2. Create `ChatInterface.tsx`, `MessageList.tsx`, `MessageInput.tsx` here.
- `src/lib/db/queries.ts` — **New file** in Phase 2. All typed CRUD functions live here: `createChat`, `getChats`, `getChat`, `getMessages`, `createMessage`, `updateChat`, `deleteChat`.

</code_context>

<specifics>
## Specific Ideas

- User went with the ChatGPT-style reference explicitly noted in PROJECT.md — "sidebar listing conversations, message thread on the right." The bubble alignment decision (user right, assistant left) is consistent with that reference.
- The pulsing dots in the thread (not outside it) maps directly to ROADMAP success criterion SC3: "A loading indicator is visible throughout the assistant's response and disappears exactly when the response is complete." Placing it in the thread makes this criterion easy to verify visually.
- The "Start Chat" button on `app/page.tsx` is a Phase 2 stub only — Phase 3 will replace it with auto-create + redirect, which is the final UX. Planner should note this so the Phase 3 task doesn't miss updating `app/page.tsx`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-loop*
*Context gathered: 2026-03-24*
