# Pitfalls Research

**Domain:** Streaming Chatbot — Next.js App Router + Vercel AI SDK + OpenAI + Drizzle ORM + Postgres
**Researched:** 2025-07-14
**Confidence:** HIGH (sourced from Vercel AI SDK GitHub issues, official migration guides, Drizzle ORM bug reports, and Next.js streaming docs)

---

## Critical Pitfalls

### Pitfall 1: Wrong Import Paths — `"ai"` vs `"ai/react"` vs `"@ai-sdk/openai"`

**What goes wrong:**
Server-side streaming functions (`streamText`, `generateText`, `createOpenAI`) get imported from `"ai/react"` (client-only), or the `useChat` hook gets imported from `"ai"` (server-side core). TypeScript may not catch this immediately; it fails silently or at runtime with cryptic module errors.

**Why it happens:**
The Vercel AI SDK is split across multiple packages with distinct responsibilities:
- `"ai"` — core server-side functions (`streamText`, `generateText`, `streamObject`)
- `"ai/react"` — React client hooks (`useChat`, `useCompletion`)
- `"@ai-sdk/openai"` — the OpenAI provider factory (`openai(...)`)

Developers copy examples that don't clarify the import split, especially when the SDK has reorganized imports across v3 → v4 → v5.

**How to avoid:**
```ts
// Route Handler (server) — app/api/chat/route.ts
import { streamText } from "ai";               // core only
import { openai } from "@ai-sdk/openai";       // provider

// Component (client) — components/chat.tsx
"use client";
import { useChat } from "ai/react";            // React hook only
```
Pin the exact SDK version in `package.json`. Do not mix imports across the server/client boundary.

**Warning signs:**
- `Cannot find module 'ai/react'` at build time
- `useChat is not a function` at runtime
- TypeScript complains about `openai` not being a valid model provider
- Build succeeds but streaming never starts

**Phase to address:** Phase 1 (Project scaffolding / dependency installation). Lock imports before writing any feature code.

---

### Pitfall 2: Using the Deprecated `StreamingTextResponse` Class

**What goes wrong:**
Vercel AI SDK v4 removed the `StreamingTextResponse` helper that was ubiquitous in v3 tutorials. Code that imports it compiles without errors if the old package is still transitively present, but behaves incorrectly or fails at runtime.

**Why it happens:**
The vast majority of pre-2024 blog posts and YouTube tutorials use `StreamingTextResponse`. Copying these examples into a v4+ project silently brings in the wrong API surface.

**How to avoid:**
```ts
// WRONG (v3 pattern — deprecated):
import { StreamingTextResponse, streamText } from "ai";
const result = await streamText({ ... });
return new StreamingTextResponse(result.textStream);

// CORRECT (v4+ pattern):
import { streamText } from "ai";
const result = streamText({ ... });
return result.toDataStreamResponse();
```
Always check `package.json` for `"ai": "^3.x"` vs `"^4.x"` when reading examples. The official docs at `sdk.vercel.ai` reflect the current version.

**Warning signs:**
- Import autocomplete shows `StreamingTextResponse` — this is the signal it exists in your installed version
- Response arrives as one big blob rather than streaming
- Frontend `useChat` shows content all at once

**Phase to address:** Phase 1 (API route scaffolding). Verify with a smoke test that token-by-token streaming actually appears in the browser before building persistence on top.

---

### Pitfall 3: Saving the Assistant Message Before the Stream Completes

**What goes wrong:**
Developer tries to `await db.insert(messages)` for the assistant response immediately after calling `streamText`, before the stream has been consumed. The response written to the DB is empty, null, or a stream object reference rather than the final text content.

**Why it happens:**
`streamText` is non-blocking by design — it returns a result object with a `textStream` (AsyncIterable) and several promises (`.text`, `.finishReason`). Calling `.text` before piping the stream causes those promises to hang indefinitely (confirmed: GitHub issue #5438: "Promise resolutions hang on streamText() if you don't loop over the stream").

**How to avoid:**
Use `onFinish` — the correct lifecycle hook for persistence:
```ts
const result = streamText({
  model: openai("gpt-4o-mini"),
  messages,
  onFinish: async ({ text, finishReason, usage }) => {
    // Stream is complete — safe to write to DB here
    await db.insert(messagesTable).values({
      chatId,
      role: "assistant",
      content: text,
    });
  },
});
return result.toDataStreamResponse();
```
`onFinish` fires exactly once per stream, after the last token is received, before the HTTP response closes.

**Warning signs:**
- Assistant messages in DB are empty strings or `[object Promise]`
- DB write appears to succeed (no error) but `content` column is blank
- Application hangs on `await result.text` in the route handler

**Phase to address:** Phase 2 (Streaming + persistence integration). This is the most common mistake in the entire stack — treat it as a first-class acceptance criterion.

---

### Pitfall 4: Not Persisting the User Message Atomically Before the LLM Call

**What goes wrong:**
The user message is saved to the DB *after* the OpenAI call completes (or inside `onFinish`). If the OpenAI call fails, the user's message is never recorded — the conversation history becomes incomplete and the UI re-renders incorrectly on next load.

**Why it happens:**
Developers think of message persistence as a single operation at the end of the request. The assistant response gets all the attention; the user message is treated as implicit.

**How to avoid:**
Follow the two-phase commit pattern:
```ts
export async function POST(req: Request) {
  const { messages, chatId } = await req.json();
  const userMessage = messages.at(-1);

  // Phase 1: Persist user message BEFORE calling OpenAI
  await db.insert(messagesTable).values({
    chatId, role: "user", content: userMessage.content,
  });

  // Phase 2: Stream response, persist in onFinish
  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages,
    onFinish: async ({ text }) => {
      await db.insert(messagesTable).values({
        chatId, role: "assistant", content: text,
      });
    },
  });

  return result.toDataStreamResponse();
}
```
This ensures: (a) the user message survives an OpenAI failure, and (b) conversation history is accurate when the page reloads.

**Warning signs:**
- Refreshing the page after a failed request shows the conversation is missing the last user turn
- DB `messages` table has assistant messages without corresponding user messages

**Phase to address:** Phase 2 (Persistence). Treat as architecture decision, not an afterthought.

---

### Pitfall 5: OpenAI Succeeds But DB Write Fails — Message Lost

**What goes wrong:**
The `onFinish` callback calls `db.insert(...)` for the assistant message. The DB is temporarily unavailable (connection timeout, pool exhausted, transient network error). The insert throws, but the error is swallowed — the stream already completed successfully from the client's perspective. The user saw the response but it was never saved. On reload, the message is gone.

**Why it happens:**
`onFinish` errors are not automatically propagated to the HTTP response (the stream has already returned `200 OK`). Error handling inside `onFinish` requires explicit try/catch; uncaught rejections disappear silently in serverless environments.

**How to avoid:**
```ts
onFinish: async ({ text }) => {
  try {
    await db.insert(messagesTable).values({ chatId, role: "assistant", content: text });
  } catch (err) {
    console.error("[chat] Failed to persist assistant message:", err);
    // For a demo: log and accept data loss for this rare case.
    // For production: enqueue a retry job or write to a fallback store.
  }
}
```
For a 1-week demo, explicit logging + accepting the rare failure is acceptable. The critical thing is to *not* silently swallow it — visibility is the minimum viable response.

Additional strategy: Add a simple retry with exponential backoff specifically for the DB write:
```ts
async function insertWithRetry(values, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await db.insert(messagesTable).values(values);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 200 * 2 ** i));
    }
  }
}
```

**Warning signs:**
- Chat history occasionally missing the last assistant message after page reload
- No error in server logs (silent failure — indicates missing try/catch in `onFinish`)
- DB connection errors correlating with high request volume

**Phase to address:** Phase 2 (Persistence). Must be addressed before demo day — silent data loss is unacceptable in a demo.

---

### Pitfall 6: Retrying the LLM Call Instead of the DB Write

**What goes wrong:**
Developer adds retry logic around the entire `streamText(...)` call. When the DB write fails in `onFinish`, the retry fires a second OpenAI call — producing a second, different response. The two responses are concatenated or the second one overwrites the first. The conversation history is corrupted.

**Why it happens:**
Treating the entire "get AI response + save to DB" as one atomic operation. OpenAI streaming calls are inherently non-idempotent — each retry produces a new, different response.

**How to avoid:**
Separate LLM retry logic from DB persistence retry logic:
- **Retry the LLM call** only for pre-stream errors: HTTP 429 (rate limit), 500, 503, or network timeouts before first token arrives.
- **Do not retry** the LLM call if `onFinish` DB write fails — the response was already streamed to the user.
- **Retry the DB write** independently (see Pitfall 5).

For pre-stream LLM retries, use exponential backoff with jitter and limit to 2–3 attempts:
```ts
// Only retryable: before stream starts
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
```

**Warning signs:**
- Duplicate assistant messages appearing in the DB
- Users see the stream complete, then see a second response appear
- Two different `assistant` messages with the same `chatId` and consecutive timestamps

**Phase to address:** Phase 2 (LLM integration + persistence). Define retry boundaries before implementing retry logic.

---

### Pitfall 7: Drizzle `push` in Development, No Migration History in CI/Production

**What goes wrong:**
Developer uses `drizzle-kit push` during local development (convenient — instantly syncs schema to DB). They forget that `push` does not create migration files. When deploying or setting up a fresh environment, there is no migration to run, and the database schema is missing tables or columns. The app crashes on first DB query.

**Why it happens:**
`drizzle-kit push` is genuinely useful for rapid local iteration. It's tempting to use it exclusively. The distinction between `push` (schema sync, no history) and `generate` + `migrate` (tracked migrations) is not obvious until it bites you.

**How to avoid:**
Establish the workflow from day one:
```bash
# Development — make schema changes then:
npx drizzle-kit generate    # creates SQL migration file in /drizzle
npx drizzle-kit migrate     # applies to local DB

# Never use push as the primary workflow for this project
# push is acceptable only for throwaway local experiments
```
Add a `db:migrate` script to `package.json` that runs on every `npm install` or `docker compose up`. Add a startup check that verifies the expected tables exist.

**Warning signs:**
- `relation "chats" does not exist` error in server logs
- App works on developer's machine but crashes for anyone else who clones the repo
- No `drizzle/` migrations directory in the repository

**Phase to address:** Phase 1 (DB setup). Establish the migration workflow before writing any schema. Commit the first migration file as part of the initial setup commit.

---

### Pitfall 8: Schema Drift — TypeScript Schema Diverges From Actual DB

**What goes wrong:**
Developer adds a column to the Drizzle TypeScript schema (`schema.ts`) but forgets to run `drizzle-kit generate` and `migrate`. Drizzle's TypeScript types reflect the new column, but the actual Postgres table doesn't have it. Insert queries fail at runtime with `column "X" of relation "Y" does not exist`.

**Why it happens:**
Drizzle is TypeScript-first — the schema definition is the source of truth. But the DB is not automatically updated when you save `schema.ts`. There is no build-time check that verifies the DB matches the schema (unlike Prisma's `@prisma/client` codegen which makes the mismatch obvious).

**How to avoid:**
- Run `npx drizzle-kit generate && npx drizzle-kit migrate` every time `schema.ts` changes.
- Add `npx drizzle-kit check` to CI or pre-commit hooks — it detects whether the schema has unapplied changes.
- Use `drizzle-kit studio` to visually verify the actual DB state during development.

For adding `NOT NULL` columns to existing tables with data:
```sql
-- WRONG: fails if table has rows
ALTER TABLE messages ADD COLUMN metadata jsonb NOT NULL;

-- CORRECT: add with default first, make NOT NULL later
ALTER TABLE messages ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
```
Drizzle `generate` handles this if the TypeScript schema includes `.default({})` — but you must review the generated SQL before applying it.

**Warning signs:**
- `column "X" does not exist` error in server logs
- Type errors disappear after adding a column to the schema but runtime errors appear
- Queries return `undefined` for new fields even though TypeScript says they exist

**Phase to address:** Phase 1 (DB setup), enforced at every schema change throughout the project.

---

### Pitfall 9: Postgres Connection Exhaustion in Development

**What goes wrong:**
Each Next.js route handler invocation in development creates a new `drizzle(new Pool(...))` connection. In dev mode, hot reloading triggers module re-initialization repeatedly. The Postgres instance (especially local Docker or Neon free tier) hits its connection limit. Queries start failing with `FATAL: too many connections` or `connection pool exhausted`.

**Why it happens:**
Next.js hot reload re-evaluates modules on each change. If the Drizzle client is initialized at module scope without a singleton guard, each reload creates a new connection pool while old ones linger.

**How to avoid:**
```ts
// lib/db.ts — singleton pattern for dev
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { db: ReturnType<typeof drizzle> };

export const db = globalForDb.db ?? drizzle(new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,  // cap pool size
}));

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
```
This reuses the same pool across hot reloads by attaching it to `globalThis`.

**Warning signs:**
- `FATAL: too many connections` after running the dev server for 10–15 minutes
- DB queries succeed on first run, fail after several hot reloads
- Local Postgres shows 50+ connections from a single dev machine

**Phase to address:** Phase 1 (DB client setup). Use the singleton pattern from the very first database file.

---

### Pitfall 10: React Hydration Mismatch With Dynamic Chat IDs or Timestamps

**What goes wrong:**
Server renders a message list with IDs generated by `Math.random()` or `Date.now()`. The client hydrates with different values. React throws: `Hydration failed because the server rendered HTML didn't match the client`. The UI flashes or goes blank.

**Why it happens:**
React SSR requires server and client to produce identical HTML. Any runtime-generated value that differs between the two render passes causes a mismatch. Chat UIs are prone to this because message IDs, timestamps, and streaming state are all dynamic.

**How to avoid:**
- Never use `Math.random()` or `Date.now()` directly in rendered JSX. Use `useId()` for React-managed IDs.
- Use `crypto.randomUUID()` on the server (consistent within a render), and pass IDs down as props rather than generating them per-render.
- For timestamps, store them in the DB and pass them as serialized ISO strings — never `new Date()` in render.
- Mark the chat message list component `"use client"` to opt out of SSR for the streaming portion:
```tsx
// Components that render streaming state should be client-only
"use client";
import { useChat } from "ai/react";
```

**Warning signs:**
- Browser console shows `Warning: Prop 'id' did not match. Server: "X" Client: "Y"`
- Page flickers or goes blank on initial load
- Chat messages appear doubled (one from SSR, one from client hydration)

**Phase to address:** Phase 2 (UI implementation). Establish ID/timestamp generation conventions before building the message list component.

---

### Pitfall 11: Next.js App Router Route Handler Not Streaming (Buffering Instead)

**What goes wrong:**
The route handler returns `result.toDataStreamResponse()` but the client receives the entire response as one chunk rather than streaming tokens. The user sees a long pause, then the full response appears instantly — no typewriter effect.

**Why it happens:**
Three common root causes:
1. **`dynamic = 'auto'` caching**: Next.js caches route handler responses by default in some configurations. A cached response is delivered in full, not streamed.
2. **Middleware consuming the body**: Custom middleware that reads `req.body` or `req.json()` before the route handler can break streaming.
3. **Wrong response type**: Returning `NextResponse.json(...)` or a plain `Response` with a string body instead of a `ReadableStream`.

**How to avoid:**
```ts
// app/api/chat/route.ts
export const dynamic = "force-dynamic";  // Prevent caching of this route

export async function POST(req: Request) {
  // ...
  const result = streamText({ ... });
  return result.toDataStreamResponse();  // Returns ReadableStream, not JSON
}
```
Also avoid wrapping the streaming response in middleware that reads the body.

**Warning signs:**
- Network tab in DevTools shows the response arriving in a single packet (no chunked transfer encoding)
- `useChat` `isLoading` state transitions directly from `true` to `false` with no intermediate streaming state
- Response `Content-Type` header is `application/json` instead of `text/event-stream` or `text/plain;charset=utf-8`

**Phase to address:** Phase 2 (Streaming implementation). Verify in browser DevTools Network tab that `Transfer-Encoding: chunked` is present before building any UI on top.

---

### Pitfall 12: Edge Runtime Incompatibility With `pg` / Node.js APIs

**What goes wrong:**
Developer adds `export const runtime = "edge"` to the chat route handler (copying from an edge-optimized example). The Drizzle + `pg` (node-postgres) driver uses Node.js `net` module, which is not available in the Edge Runtime. The build succeeds but deployment or runtime fails with: `The edge runtime does not support Node.js 'net' module`.

**Why it happens:**
The Edge Runtime is a subset of Web APIs — it intentionally excludes Node.js built-ins for portability. The `pg` driver requires `net.Socket` for TCP connections, which is Node.js-only.

**How to avoid:**
Do not use `runtime = "edge"` with `drizzle-orm/node-postgres`. Either:
1. Use the default Node.js runtime (no `export const runtime` needed — this is the default)
2. If edge runtime is truly needed, switch to `drizzle-orm/neon-http` with `@neondatabase/serverless` which uses HTTP (edge-compatible)

For this project (local demo, no edge deployment needed): simply omit `runtime = "edge"` everywhere.

**Warning signs:**
- Build succeeds but `next start` or deployment fails
- Error: `The edge runtime does not support Node.js 'net' module`
- Error: `Dynamic Code Evaluation (e. g. 'eval', 'new Function') not allowed in Edge Runtime`

**Phase to address:** Phase 1 (Scaffolding). If no `runtime` export is present, Next.js defaults to Node.js — the safe default for this stack.

---

### Pitfall 13: Stream Abort / Stop Button Causes `ResponseAborted` Error

**What goes wrong:**
User clicks "Stop" during a streaming response. The client calls `useChat`'s `stop()` method, which sends an abort signal. On the server, the stream terminates with a `ResponseAborted` error instead of gracefully calling `onFinish`. The partial assistant message is not saved to the DB. On reload, the conversation appears to have no assistant response for that turn.

**Why it happens:**
The `stop()` function aborts the fetch request mid-stream. In some SDK versions (confirmed: GitHub issue #5459), this triggers an unhandled `ResponseAborted` error that bypasses `onFinish`. The `onAbort` callback is the correct hook for this case, but many implementations don't implement it.

**How to avoid:**
Implement both `onFinish` (normal completion) and `onAbort` (user-interrupted) callbacks:
```ts
const result = streamText({
  model: openai("gpt-4o-mini"),
  messages,
  onFinish: async ({ text }) => {
    await saveAssistantMessage(chatId, text);
  },
  onAbort: async () => {
    // Stream was interrupted — text so far is NOT available in onAbort
    // Options: (1) accept the partial loss, (2) use a shared variable
    console.log("[chat] Stream aborted by client");
    // For demo: acceptable to not save partial responses
  },
});
return result.toDataStreamResponse();
```

Important: `abort` (stop button) and `resume` (resumable streams) are **mutually exclusive** in the SDK. Choose one pattern and do not combine them.

**Warning signs:**
- Server logs show `ResponseAborted` or `AbortError` on user-initiated stops
- Chat history missing the partial response after user stops generation
- `onFinish` never fires after clicking Stop

**Phase to address:** Phase 2 (Streaming implementation). Handle before wiring up any stop UI element.

---

### Pitfall 14: `useChat` `id` Change During Streaming Leaks Previous Stream

**What goes wrong:**
User navigates to a different chat while a response is streaming. The `useChat` hook's `id` prop changes to the new chat ID. The previous stream continues running — tokens from the old chat's response get appended to the new chat's messages. DB writes from `onFinish` may write the old response to the wrong chat.

**Why it happens:**
Known SDK bug (GitHub issue #13304): when `id` changes, `useChat` does not call `stop()` on the previous chat instance. The old fetch continues until completion.

**How to avoid:**
Add a `useEffect` cleanup that calls `stop()` when the chat ID changes or the component unmounts:
```tsx
const { messages, stop, isLoading } = useChat({ id: chatId, api: "/api/chat" });

useEffect(() => {
  return () => {
    if (isLoading) stop();
  };
}, [chatId]);
```

**Warning signs:**
- Messages from chat A appearing in chat B's thread after rapid navigation
- `onFinish` fires with `chatId` from a previous session
- Two simultaneous network requests visible in DevTools for the same `/api/chat` endpoint

**Phase to address:** Phase 3 (Multi-chat navigation / sidebar). Must be addressed when implementing chat switching.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `drizzle-kit push` for all schema changes | Fast iteration, no migration files | No migration history; new devs can't set up DB | Never — use `generate` + `migrate` from day one |
| Inline `new Pool(...)` in every route handler | No setup overhead | Connection exhaustion in dev after hot reloads | Never — use singleton pattern |
| Skipping `onAbort` handler | Fewer lines of code | Partial responses silently lost on user stop | Acceptable for a demo; must log the abort |
| `any` types for `messages` array passed to OpenAI | Bypasses type friction | Type errors surface at demo time, not build time | Never — use `CoreMessage[]` from `"ai"` |
| Saving only the final message, not full history | Simpler DB schema | Multi-turn context breaks; LLM lacks conversation history | Never — multi-turn is a core requirement |
| Using `console.log` for all error visibility | Zero setup | No structured error trail; hard to debug demo failures | Acceptable for 1-week demo scope |
| Hardcoding `chatId` during development | Faster feature development | Breaks multi-chat support; DB data gets corrupted | Only in the very first day of scaffolding |

---

## Integration Gotchas

Common mistakes when connecting external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI via `@ai-sdk/openai` | Using `process.env.OPENAI_API_KEY` inside the `openai()` call explicitly | The `@ai-sdk/openai` provider reads `OPENAI_API_KEY` automatically from env — just call `openai("gpt-4o-mini")` |
| Drizzle + `pg` | Creating a new `Pool` on every request | Singleton `db` client in `lib/db.ts` attached to `globalThis` |
| `streamText` result | Awaiting `result.text` before returning the response | Call `result.toDataStreamResponse()` first — `result.text` resolves only after the stream is fully consumed |
| `useChat` hook | Not passing `id` prop — defaults to a random UUID per mount | Always pass explicit `id: chatId` to tie the hook to a specific DB conversation |
| Postgres `DATABASE_URL` | Including connection params incompatible with `pg` (e.g., `?sslmode=require` on local Docker) | Ensure `DATABASE_URL` matches the environment: no SSL for local Docker, SSL params for hosted providers |
| Drizzle `drizzle.config.ts` | `out` directory not committed — migrations lost | Commit the `drizzle/` directory; it contains the canonical migration history |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full message history on every request | Slow responses as conversations grow | Limit history sent to OpenAI (last N messages) | ~50+ messages in a single conversation |
| No connection pooling (`max` not set on Pool) | DB connection exhaustion under concurrent requests | `max: 10` in Pool config | 2–3 simultaneous users |
| Storing full `messages` array in `useChat` state without pagination | Browser memory growth; slow re-renders | Paginate or truncate displayed messages | ~200+ messages in the UI |
| Sending entire conversation history to OpenAI without token count check | `context_length_exceeded` error (400) | Trim history to stay within model context window | GPT-4o-mini: ~128k tokens — generous, but long chats will hit it |
| Blocking DB writes in `onFinish` without timeout | Slow DB = slow perceived chat completion | Add a DB write timeout (5s max) | DB latency spikes above 2s |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `OPENAI_API_KEY` in client-side code | Key extracted from browser — API charges on your account | Never import from `@ai-sdk/openai` in client components; key stays server-side only |
| Not sanitizing `chatId` from request body before DB query | SQL injection or cross-chat data leakage | Validate `chatId` is a valid UUID; use Drizzle's parameterized queries (automatic) |
| No rate limiting on `/api/chat` | Unlimited OpenAI API calls exploiting the demo | For single-user demo: acceptable; add IP-based rate limit before any public exposure |
| Logging full message content to server logs | Conversation data in log files | Log only metadata (message ID, length, finish reason) — not content |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading indicator before first token arrives | 2–5s of silence feels like the app is broken | Show a "thinking" indicator (`isLoading` from `useChat`) immediately after send |
| No Stop button during streaming | User can't interrupt a long response | Render a Stop button when `isLoading === true`; call `stop()` on click |
| Scroll position doesn't follow streaming tokens | User has to manually scroll to see new content | Auto-scroll to bottom when new content arrives; stop auto-scroll when user scrolls up |
| Error state not displayed in chat thread | Silent failure looks like the app hung | Catch `useChat`'s `onError` callback and render an error message in the thread |
| Input disabled during streaming but not obviously so | User types a follow-up message and loses it | Disable the input with visual feedback; queue or discard mid-stream submissions explicitly |
| Chat title is "New Chat" forever | Sidebar becomes useless with many chats | Generate a title from the first user message (can use a non-streaming `generateText` call) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Streaming:** Verify in DevTools Network tab that response uses `Transfer-Encoding: chunked` — not a single payload
- [ ] **Persistence:** Reload the page after a conversation — all messages (user and assistant) must reappear from the DB
- [ ] **Multi-turn context:** Send a follow-up message referencing an earlier answer — the model must remember it
- [ ] **Error recovery:** Kill the DB mid-conversation — the stream should complete (from client's view), with an error logged server-side
- [ ] **Stop button:** Click Stop mid-stream — the response should halt, no `ResponseAborted` error in console
- [ ] **Chat switching:** Navigate to a different chat while streaming — previous stream must not bleed into the new chat
- [ ] **Fresh environment:** Clone the repo on a new machine, run `npm install` + migration command, start the app — it must work with zero manual SQL
- [ ] **Multiple chats:** Create three separate chats — each must show only its own messages on reload
- [ ] **Retry logic:** Disconnect from the internet, send a message — a clear error should display, not a silent hang

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing assistant messages in DB | LOW | Query OpenAI API logs (if enabled) for the session; manually re-insert the missing content |
| Schema drift (DB doesn't match schema.ts) | MEDIUM | Run `npx drizzle-kit generate` to see the diff; review the SQL; run `npx drizzle-kit migrate` against the target DB |
| Connection exhaustion in dev | LOW | Restart the Next.js dev server (`Ctrl+C`, `npm run dev`); this clears stale connections |
| Wrong SDK version imported | MEDIUM | `npm ls ai` to confirm installed version; update `package.json` to pin the correct major version; clear `node_modules` |
| Hydration mismatch blowing up the UI | MEDIUM | Add `suppressHydrationWarning` temporarily to isolate the component; fix the dynamic value source; remove the suppression |
| Streaming not working (buffered response) | LOW | Add `export const dynamic = "force-dynamic"` to the route handler; verify `Content-Type` header in DevTools |
| Duplicate assistant messages from retry bug | MEDIUM | Add a unique constraint on `(chatId, createdAt, role)` or use a generated `messageId` as the primary key; deduplicate existing rows manually |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong import paths (`"ai"` vs `"ai/react"`) | Phase 1 — Scaffolding | Build succeeds; TypeScript strict mode shows no module errors |
| Deprecated `StreamingTextResponse` | Phase 1 — Scaffolding | Grep codebase for `StreamingTextResponse` — must return zero results |
| Saving assistant message before stream completes | Phase 2 — Streaming + Persistence | Reload page after chat; assistant message present in DB |
| User message not persisted before LLM call | Phase 2 — Streaming + Persistence | Kill network after send; user message exists in DB |
| OpenAI succeeds, DB write fails silently | Phase 2 — Streaming + Persistence | Simulate DB failure in `onFinish`; error appears in server logs |
| Retrying LLM call for DB failures | Phase 2 — LLM integration | No duplicate assistant messages after transient DB errors |
| `drizzle-kit push` only, no migration files | Phase 1 — DB setup | `drizzle/` directory committed with at least one migration file |
| Schema drift | Phase 1 (ongoing) | `npx drizzle-kit check` returns no pending changes |
| Connection exhaustion | Phase 1 — DB client setup | Dev server running for 30 min with hot reloads shows stable connection count |
| Hydration mismatch | Phase 2 — UI | Zero hydration warnings in browser console on page load |
| Route handler not streaming | Phase 2 — Streaming | DevTools Network shows chunked transfer; first token arrives within 1s |
| Edge runtime incompatibility | Phase 1 — Scaffolding | No `export const runtime = "edge"` in any route handler file |
| Stop button `ResponseAborted` error | Phase 2 — Streaming | Stop mid-stream; zero unhandled errors in server console |
| Stream leaking across chat navigation | Phase 3 — Multi-chat UI | Navigate chats rapidly during streaming; no cross-chat token contamination |

---

## Sources

- [Vercel AI SDK migration guide v3 → v4](https://sdk.vercel.ai/docs/migration-guides/migration-guide-4-0)
- [Vercel AI SDK GitHub: `onFinish` only returns `message`, not `messages` (issue #9307)](https://github.com/vercel/ai/issues/9307)
- [Vercel AI SDK GitHub: Promise resolutions hang if stream not consumed (issue #5438)](https://github.com/vercel/ai/issues/5438)
- [Vercel AI SDK GitHub: Stop button causes `ResponseAborted` error (issue #5459)](https://github.com/vercel/ai/issues/5459)
- [Vercel AI SDK GitHub: `useChat` id change doesn't abort previous stream (issue #13304)](https://github.com/vercel/ai/issues/13304)
- [Vercel AI SDK GitHub: Guidance on persisting messages (discussion #4845)](https://github.com/vercel/ai/discussions/4845)
- [Vercel AI SDK docs: Stopping Streams](https://ai-sdk.dev/docs/advanced/stopping-streams)
- [Vercel AI SDK docs: Chatbot message persistence](https://sdk.vercel.ai/cookbook/next/save-messages-to-database)
- [Drizzle ORM GitHub: Connection pool exhausted (issue #928)](https://github.com/drizzle-team/drizzle-orm/issues/928)
- [Drizzle push vs migrate explainer](https://www.oreateai.com/blog/drizzle-push-vs-migrate-navigating-database-management-with-drizzle-kit)
- [MakerKit: Next.js Drizzle migration workflow](https://makerkit.dev/docs/nextjs-drizzle/database/migrations)
- [Next.js GitHub: SSE doesn't work in API routes (discussion #48427)](https://github.com/vercel/next.js/discussions/48427)
- [Vercel AI chatbot GitHub: Hydration mismatch issue #1303](https://github.com/vercel/ai-chatbot/issues/1303)
- [Drizzle + Neon connection storm prevention](https://heydev.us/blog/drizzle-neon-vercel-connection-storm-fix-2026)
- [LLM API idempotency and retry patterns](https://markaicode.com/idempotent-ai-endpoints-retries/)
- [Next.js Edge Runtime API reference](https://nextjs.org/docs/app/api-reference/edge)

---
*Pitfalls research for: Streaming Chatbot (Next.js + Vercel AI SDK + OpenAI + Drizzle + Postgres)*
*Researched: 2025-07-14*
