---
id: 02-02-route-handler
phase: 2
wave: 2
depends_on: [02-01-db-query-layer]
files_modified:
  - src/app/api/chat/route.ts
autonomous: true
requirements: [MSG-01, MSG-02, MSG-03, PERS-02, PERS-03, RELY-01, RELY-02, RELY-03]
---

# Plan 02: Route Handler — Streaming, Persistence, and Retry

## Objective

Extend `src/app/api/chat/route.ts` from its Phase 1 stub to the full production implementation:
1. Extract `chatId` from request body
2. Persist the user message to Postgres BEFORE calling the LLM (PERS-02, RELY-02)
3. Convert UIMessages to ModelMessages via `convertToModelMessages` (required for AI SDK v6)
4. Call `streamText` with built-in `maxRetries: 2` (RELY-01)
5. Persist the assistant response inside `onFinish` with try/catch (PERS-03)
6. Return `result.toUIMessageStreamResponse()` for streaming (MSG-02)

This plan addresses all five persistence failure modes documented in RESEARCH.md §8.

<tasks>

<task id="T01" title="Extend route handler with chatId extraction, persistence, convertToModelMessages, and onFinish">
  <read_first>
  - `src/app/api/chat/route.ts` — current Phase 1 stub (streamText + toUIMessageStreamResponse, no persistence yet)
  - `src/lib/db/queries.ts` — createMessage, getChat signatures (from Plan 01)
  - `.planning/phases/02-core-loop/02-RESEARCH.md` — §3.1 full route handler pattern, §8 five failure modes, §10 convertToModelMessages requirement
  </read_first>

  <action>
  Replace the entire content of `src/app/api/chat/route.ts` with:

  ```typescript
  import { streamText, convertToModelMessages } from 'ai';
  import { openai } from '@ai-sdk/openai';
  import { createMessage } from '@/lib/db/queries';

  export const dynamic = 'force-dynamic';

  export async function POST(req: Request) {
    const { id: chatId, messages } = await req.json();

    // Validate chatId — required to associate messages with a conversation
    if (!chatId || typeof chatId !== 'string') {
      return new Response('Missing chatId', { status: 400 });
    }

    // ── STEP 1: Persist user message BEFORE calling LLM ──────────────────────────
    // (PERS-02, RELY-02 — user message saved exactly once, outside retry loop)
    // The last message in the array is always the new user message for trigger=submit-message
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === 'user') {
      await createMessage({
        id: crypto.randomUUID(),
        chatId,
        role: 'user',
        content: lastMessage.parts
          ?.filter((p: { type: string }) => p.type === 'text')
          .map((p: { type: string; text: string }) => p.text)
          .join('') ?? '',
      });
    }

    // ── STEP 2: Convert UIMessage[] to ModelMessage[] (REQUIRED for ai@6) ────────
    // convertToModelMessages is async — must await. Passing UIMessage[] directly to
    // streamText causes TypeScript errors and runtime failures.
    const modelMessages = await convertToModelMessages(messages);

    // ── STEP 3: Stream with built-in retry (RELY-01) ──────────────────────────────
    // SDK default: maxRetries=2, exponential backoff, retries on 429/5xx/timeout only.
    // User message save above is NOT in the retry path — no duplication risk (RELY-02).
    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: modelMessages,
      system: 'You are a helpful assistant.',
      maxRetries: 2,
      onFinish: async ({ text }) => {
        // ── STEP 4: Persist assistant response after stream completes (PERS-03) ───
        // onFinish fires exactly once per successful stream.
        // MUST be wrapped in try/catch — HTTP response already sent (200 OK),
        // so errors here cannot propagate to the client (Failure Mode 3).
        try {
          await createMessage({
            id: crypto.randomUUID(),
            chatId,
            role: 'assistant',
            content: text,
          });
        } catch (err) {
          // Silent DB failures are unacceptable — log explicitly
          console.error('[chat] CRITICAL: Failed to persist assistant message:', {
            chatId,
            textLength: text.length,
            error: err,
          });
        }
      },
    });

    // ── STEP 5: Return streaming response ────────────────────────────────────────
    // toUIMessageStreamResponse() returns a Response backed by a ReadableStream.
    // Do NOT await result.text before returning — that causes a hang (Failure Mode 1).
    // export const dynamic = 'force-dynamic' prevents Next.js from buffering (Failure Mode 5).
    return result.toUIMessageStreamResponse();
  }
  ```

  Key architectural decisions enforced:
  - `const { id: chatId, messages } = await req.json()` — SDK sends `id` field automatically from `useChat({ id: chatId })`
  - User message saved ONCE before `streamText` — not inside `onFinish`, not in retry loop
  - `await convertToModelMessages(messages)` — async conversion required before streamText
  - `maxRetries: 2` — explicit for documentation even though it is the SDK default
  - `onFinish` has `try/catch` + structured error log with chatId and textLength
  - Final return is `result.toUIMessageStreamResponse()` — never `toDataStreamResponse()` (doesn't exist in ai@6)
  </action>

  <acceptance_criteria>
  - `src/app/api/chat/route.ts` contains `import { streamText, convertToModelMessages } from 'ai'`
  - `src/app/api/chat/route.ts` contains `import { createMessage } from '@/lib/db/queries'`
  - `src/app/api/chat/route.ts` contains `const { id: chatId, messages } = await req.json()`
  - `src/app/api/chat/route.ts` contains `await createMessage(` (appears before `streamText(` in file)
  - `src/app/api/chat/route.ts` contains `await convertToModelMessages(messages)`
  - `src/app/api/chat/route.ts` contains `maxRetries: 2`
  - `src/app/api/chat/route.ts` contains `onFinish`
  - `src/app/api/chat/route.ts` contains `try {` (inside onFinish block)
  - `src/app/api/chat/route.ts` contains `console.error('[chat] CRITICAL`
  - `src/app/api/chat/route.ts` contains `return result.toUIMessageStreamResponse()`
  - `src/app/api/chat/route.ts` contains `export const dynamic = 'force-dynamic'`
  - `src/app/api/chat/route.ts` does NOT contain `toDataStreamResponse`
  </acceptance_criteria>
</task>

</tasks>

<verification>
TypeScript check:
```bash
npx tsc --noEmit
```
Expected: No errors in `src/app/api/chat/route.ts`.

Verify streaming response (run dev server, then check network):
```bash
npm run dev
# In browser DevTools → Network → POST /api/chat → Headers
# Expected header: Transfer-Encoding: chunked
# Expected: response body shows incremental data frames, not a single chunk
```

Verify user-message-before-LLM ordering:
```bash
grep -n "createMessage\|streamText\|convertToModelMessages" src/app/api/chat/route.ts
```
Expected: `createMessage` appears on a lower line number than `convertToModelMessages`, which appears before `streamText`.
</verification>

<must_haves>
- User message is persisted BEFORE `streamText` is called — not inside `onFinish`
- `convertToModelMessages` is called and awaited before `streamText`
- `onFinish` wraps the DB write in `try/catch` with `console.error` on failure
- `maxRetries: 2` is set on `streamText` (satisfies RELY-01)
- Route returns `result.toUIMessageStreamResponse()` — streaming, not buffered JSON
- `export const dynamic = 'force-dynamic'` is present
- `chatId` validation returns 400 if missing
</must_haves>
