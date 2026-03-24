---
phase: 02-core-loop
verified_at: 2026-03-24
status: passed
score: 12/12
---

# Phase 2 Verification Report — Core Loop

## Scope

Requirements checked: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, PERS-01, PERS-02, PERS-03, PERS-04, RELY-01, RELY-02, RELY-03

Files inspected:
- `src/app/api/chat/route.ts`
- `src/lib/db/queries.ts`
- `src/components/ChatInterface.tsx`
- `src/components/MessageList.tsx`
- `src/components/MessageInput.tsx`
- `src/app/chat/[chatId]/page.tsx`
- `src/app/page.tsx`
- `.planning/phases/02-core-loop/02-01-db-query-layer-SUMMARY.md`
- `.planning/phases/02-core-loop/02-02-route-handler-SUMMARY.md`
- `.planning/phases/02-core-loop/02-03-chat-components-SUMMARY.md`
- `.planning/phases/02-core-loop/02-04-chat-page-SUMMARY.md`

---

## Requirement Verdicts

### MSG-01 — User can type a message and send it to the LLM

**Verdict: PASS**

Evidence:
- `ChatInterface.tsx` imports and calls `useChat` from `@ai-sdk/react` with `id: chatId` and `messages: initialMessages`.
- `sendMessage` is destructured from the hook and wired to `MessageInput` via the `onSend` prop: `onSend={(text) => sendMessage({ text })}`.
- `MessageInput.tsx` renders a `<textarea>` and a `<button type="submit">` inside a `<form onSubmit={handleSubmit}>`. On submit it calls `onSend(input.trim())`, which fires `sendMessage({ text })` on the hook, triggering a POST to `/api/chat`.
- The route handler at `src/app/api/chat/route.ts` is an `export async function POST(req: Request)` that receives the message and streams an LLM response.

---

### MSG-02 — Assistant response renders in streaming mode (tokens as they arrive)

**Verdict: PASS**

Evidence:
- `route.ts` returns `result.toUIMessageStreamResponse()`, which returns a `Response` backed by a `ReadableStream` — chunked transfer, not a buffered JSON body.
- `export const dynamic = 'force-dynamic'` is set on the route, preventing Next.js from buffering the stream at the framework layer.
- `MessageList.tsx` renders messages using the `getTextContent()` helper which iterates over `message.parts` (the AI SDK v6 streaming parts format). As the `useChat` hook receives partial tokens it updates the `messages` array, causing `MessageList` to re-render incrementally with each new chunk.
- The route does NOT await `result.text` before responding (explicitly noted in a code comment as the failure mode to avoid).

---

### MSG-03 — Multi-turn conversation supported (full history sent to LLM each turn)

**Verdict: PASS**

Evidence:
- `ChatInterface.tsx` passes `messages: initialMessages` to `useChat`, seeding the hook with the full DB-fetched message history on page load.
- `useChat` maintains the accumulated `messages` array and sends it in full in every POST body.
- `route.ts` reads `const { id: chatId, messages } = await req.json()` — the entire messages array — then calls `const modelMessages = await convertToModelMessages(messages)` to convert the full `UIMessage[]` history to `ModelMessage[]`.
- `streamText({ ..., messages: modelMessages, ... })` forwards the complete conversation history to the LLM on every turn.

---

### MSG-04 — User sees a loading indicator while the assistant is responding

**Verdict: PASS**

Evidence:
- `ChatInterface.tsx` derives `isLoading = status === 'submitted' || status === 'streaming'` from the `useChat` status and passes it to both child components.
- `MessageList.tsx` renders a pulsing three-dot indicator when `isLoading` is true:
  ```tsx
  {isLoading && (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )}
  ```
- `MessageInput.tsx` derives `isLoading` independently from the `status` prop and sets `disabled={isLoading}` on both the `<textarea>` and the `<button>`, with `disabled:opacity-50 disabled:cursor-not-allowed` CSS classes providing visual feedback.

---

### MSG-05 — User sees an error message if the LLM call fails

**Verdict: PASS**

Evidence:
- `ChatInterface.tsx` destructures `error` from `useChat` and passes it to `MessageList` as a prop.
- `MessageList.tsx` renders an inline error bubble in the message thread when `error && !isLoading`:
  ```tsx
  {error && !isLoading && (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
        {error.message || 'Something went wrong. Please try again.'}
      </div>
    </div>
  )}
  ```
- The error appears in the thread position where a response would have been, styled in red — not a blank screen, not an unhandled exception.
- Fallback text `'Something went wrong. Please try again.'` handles cases where `error.message` is empty.

---

### PERS-01 — Chat records stored in Postgres (create chat on new conversation)

**Verdict: PASS**

Evidence:
- `queries.ts` exports `createChat(id?: string): Promise<Chat>` which performs a Drizzle `db.insert(chats).values({ id: chatId, title: 'New Chat' }).returning()`.
- `src/app/page.tsx` defines a Server Action `startChat` marked `'use server'` that calls `const chat = await createChat()` then `redirect(\`/chat/${chat.id}\`)` — every new conversation creates a row in the `chats` table before the user ever types a message.

---

### PERS-02 — User message persisted to Postgres BEFORE the LLM call

**Verdict: PASS**

Evidence:
- In `route.ts` the user message persistence is step 1, before any LLM involvement:
  ```ts
  // Step 1 (line ~20): persist user message
  await createMessage({ id: crypto.randomUUID(), chatId, role: 'user', content: ... });

  // Step 2 (line ~34): convert messages
  const modelMessages = await convertToModelMessages(messages);

  // Step 3 (line ~39): call LLM
  const result = streamText({ ... });
  ```
- The `createMessage` call for the user message is unconditionally awaited before `streamText` is invoked — no LLM call can proceed without the user message already being in Postgres.
- A code comment explicitly labels this as satisfying PERS-02 and RELY-02.

---

### PERS-03 — Assistant response persisted to Postgres after streaming completes (via onFinish)

**Verdict: PASS**

Evidence:
- `route.ts` provides an `onFinish` callback to `streamText`:
  ```ts
  onFinish: async ({ text }) => {
    try {
      await createMessage({
        id: crypto.randomUUID(),
        chatId,
        role: 'assistant',
        content: text,
      });
    } catch (err) {
      console.error('[chat] CRITICAL: Failed to persist assistant message:', {
        chatId,
        textLength: text.length,
        error: err,
      });
    }
  },
  ```
- `onFinish` fires exactly once per successful stream, after all tokens have been sent, with `text` containing the full assembled response.
- The `try/catch` ensures that a DB failure in `onFinish` does not cause an unhandled exception. Since the HTTP 200 response is already sent before `onFinish` fires, the error is logged server-side with structured context (`chatId`, `textLength`).

---

### PERS-04 — Fetching conversation messages from Postgres and loading into chat view

**Verdict: PASS**

Evidence:
- `src/app/chat/[chatId]/page.tsx` is a Server Component that:
  1. Awaits `params` to get `chatId` (Next.js 15 async params pattern).
  2. Calls `getChat(chatId)` and invokes `notFound()` if the chat row does not exist.
  3. Calls `const dbMessages = await getMessages(chatId)` from `@/lib/db/queries`.
  4. Converts `Message[]` (DB shape, `content: string`) to `UIMessage[]` (AI SDK v6 shape, `parts: [{ type: 'text', text }]`) with `metadata: {}`.
  5. Passes `chatId={chatId}` and `initialMessages={initialMessages}` to `<ChatInterface>`.
- `ChatInterface.tsx` passes `initialMessages` as `messages: initialMessages` to `useChat`, seeding the hook with the full persisted history so a page reload restores the complete conversation.

---

### RELY-01 — Backend retries LLM calls on transient failure — minimum 2 retries with backoff

**Verdict: PASS**

Evidence:
- `route.ts` passes `maxRetries: 2` explicitly to `streamText`:
  ```ts
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: modelMessages,
    system: 'You are a helpful assistant.',
    maxRetries: 2,
    ...
  });
  ```
- The AI SDK's built-in retry mechanism retries on 429, 5xx, and network timeouts with exponential backoff. `maxRetries: 2` means the initial attempt plus up to 2 retries — satisfying the "minimum 2 retries" requirement.
- A code comment confirms: "SDK default: maxRetries=2, exponential backoff, retries on 429/5xx/timeout only."

---

### RELY-02 — Retry logic does not duplicate messages (user message saved once, before retries)

**Verdict: PASS**

Evidence:
- The `await createMessage(...)` for the user message (PERS-02) executes at step 1, before `streamText` is called.
- `streamText` handles all retry attempts internally — the retry loop is entirely inside the SDK, below the `streamText` call site.
- The user `createMessage` call is therefore structurally outside the retry loop: it runs exactly once regardless of how many times the SDK retries the LLM call.
- A code comment in `route.ts` explicitly labels this: `"User message save above is NOT in the retry path — no duplication risk (RELY-02)."`

---

### RELY-03 — Errors after all retries exhausted are surfaced to the user (not swallowed)

**Verdict: PASS**

Evidence:
- When `streamText` exhausts all retries, it throws/rejects, which causes the `useChat` hook to set its `error` state with the error object.
- `ChatInterface.tsx` destructures `error` from `useChat` and passes it to `MessageList`.
- `MessageList.tsx` renders the red inline error bubble (documented under MSG-05) whenever `error` is truthy and `isLoading` is false — meaning errors after all retries complete are immediately visible in the UI.
- The path from LLM failure → SDK error → `useChat.error` → `MessageList` error bubble is fully wired and does not require any additional try/catch in the component layer.

---

## Overall Score

**12 / 12 must-have requirements verified.**

| ID | Description | Verdict |
|----|-------------|---------|
| MSG-01 | User can type and send a message | PASS |
| MSG-02 | Assistant response streams token-by-token | PASS |
| MSG-03 | Full message history sent to LLM each turn | PASS |
| MSG-04 | Loading indicator visible while responding | PASS |
| MSG-05 | Error message shown on LLM failure | PASS |
| PERS-01 | Chat records created in Postgres | PASS |
| PERS-02 | User message persisted before LLM call | PASS |
| PERS-03 | Assistant response persisted in onFinish | PASS |
| PERS-04 | Messages fetched from DB and loaded as initialMessages | PASS |
| RELY-01 | maxRetries: 2 configured on streamText | PASS |
| RELY-02 | User message save is outside the retry loop | PASS |
| RELY-03 | Post-retry errors surfaced in UI via useChat error state | PASS |

---

## Human Verification Items

The following correctness properties cannot be confirmed by static code inspection alone. They require a running environment.

| # | Check | How to verify |
|---|-------|---------------|
| HV-01 | Streaming is truly chunked (not buffered) | Open DevTools → Network tab → select the POST to `/api/chat` → confirm `Transfer-Encoding: chunked` and observe incremental data frames arriving before the response is complete |
| HV-02 | Page reload restores full message history | Send several messages, perform a hard reload (`Ctrl+Shift+R`), confirm all messages reappear in order with no duplicates |
| HV-03 | Retry does not duplicate the user message in DB | Simulate a transient failure (e.g., temporarily set an invalid API key to trigger a 401 or disconnect network mid-first-attempt), then confirm the `messages` table contains the user message exactly once |
| HV-04 | onFinish DB failure is logged but does not crash | Temporarily break the DB connection after the user message is saved, confirm the assistant stream still reaches the browser and the server emits the `[chat] CRITICAL` log line |
| HV-05 | Error bubble appears after LLM failure | Set `OPENAI_API_KEY` to an invalid value, send a message, confirm a red error bubble appears — not a blank screen or uncaught exception |

---

## Issues Found

None. All 12 static checks passed. No gaps, missing implementations, or incorrect wiring detected.

---

## Notes

- The `onFinish` try/catch correctly handles only DB-side persistence failures. LLM failures (post-retry) propagate through the `useChat` hook's `error` state as required by RELY-03. These are two distinct error paths with correct handling for each.
- `MessageInput.tsx` manages its own `input` state with `useState` rather than delegating to `useChat` — this is the correct AI SDK v6 pattern (`handleInputChange` is not available in v6).
- The `useChat` hook uses `messages: initialMessages` (not the legacy `initialMessages` option key) — correct for AI SDK v6.
- `ChatStatus` type is imported from `'ai'` in `MessageInput.tsx` — typed correctly for the four states: `submitted | streaming | ready | error`.
