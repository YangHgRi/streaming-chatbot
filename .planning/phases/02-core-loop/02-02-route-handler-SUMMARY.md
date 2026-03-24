# Summary: Plan 02-02 — Route Handler (Streaming, Persistence, Retry)

**Plan:** `.planning/phases/02-core-loop/02-02-route-handler.md`
**Phase:** 2 — Core Loop
**Status:** Complete
**Executed:** 2026-03-24
**Commit:** `4c920bd` — `feat(02-02): extend chat route handler with streaming, persistence, and retry`

---

## Tasks Completed

### T01 — Extend route handler with chatId extraction, persistence, convertToModelMessages, and onFinish

**Status:** Complete  
**Files modified:** `src/app/api/chat/route.ts`

Replaced the Phase 1 stub with the full production implementation:

1. **chatId extraction and validation** — Destructured `id` as `chatId` from request body; returns HTTP 400 if missing or not a string.
2. **User message persistence (PERS-02, RELY-02)** — Inspects the last message in the array; if `role === 'user'`, calls `createMessage()` with `crypto.randomUUID()` before any LLM call. Text parts are filtered from `lastMessage.parts` and joined. This is outside the retry loop — no duplication risk.
3. **UIMessage → ModelMessage conversion (ai@6 requirement)** — `convertToModelMessages(messages)` is awaited before `streamText`; passing `UIMessage[]` directly to `streamText` in ai@6 causes TypeScript and runtime failures.
4. **streamText with built-in retry (RELY-01)** — `maxRetries: 2` is explicit (SDK default = 2); exponential backoff retries on 429, 5xx, and network timeouts only.
5. **Assistant persistence in onFinish (PERS-03)** — Wrapped in `try/catch`; on failure emits a structured `console.error('[chat] CRITICAL: ...')` with `chatId` and `textLength` context. HTTP response was already sent before `onFinish` fires — errors here cannot propagate to the client.
6. **Streaming response** — Returns `result.toUIMessageStreamResponse()` (not `toDataStreamResponse()` which does not exist in ai@6).
7. **Route caching opt-out** — `export const dynamic = 'force-dynamic'` prevents Next.js from buffering the stream.

---

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `import { streamText, convertToModelMessages } from 'ai'` | ✅ PASS |
| `import { createMessage } from '@/lib/db/queries'` | ✅ PASS |
| `const { id: chatId, messages } = await req.json()` | ✅ PASS |
| `await createMessage(` appears before `streamText(` in file | ✅ PASS (line 20 vs 39) |
| `await convertToModelMessages(messages)` | ✅ PASS |
| `maxRetries: 2` | ✅ PASS |
| `onFinish` callback | ✅ PASS |
| `try {` inside onFinish | ✅ PASS |
| `console.error('[chat] CRITICAL` | ✅ PASS |
| `return result.toUIMessageStreamResponse()` | ✅ PASS |
| `export const dynamic = 'force-dynamic'` | ✅ PASS |
| Does NOT contain `toDataStreamResponse` | ✅ PASS |

---

## Verification

### TypeScript check
```
npx tsc --noEmit
```
**Result:** Zero errors. Clean compile.

### Function ordering check
```
grep -n "createMessage|streamText|convertToModelMessages" src/app/api/chat/route.ts
```
**Result:**
- Line 3: `import { createMessage }` 
- Line 20: `await createMessage(` (user message, before LLM)
- Line 34: `const modelMessages = await convertToModelMessages(messages)`
- Line 39: `const result = streamText({`
- Line 50: `await createMessage(` (assistant, inside onFinish)

Order is correct: `createMessage` (user) → `convertToModelMessages` → `streamText` → `createMessage` (assistant in onFinish).

---

## Deviations from Plan

None — plan executed exactly as written. The route handler code in the plan was followed verbatim.

**Total deviations:** 0 auto-fixed. **Impact:** None.

---

## Requirements Addressed

| Requirement | Description | Status |
|-------------|-------------|--------|
| MSG-01 | User can type a message and send it to the LLM | ✅ Route handler processes POST requests |
| MSG-02 | Assistant response renders in streaming mode | ✅ `toUIMessageStreamResponse()` enables chunked streaming |
| MSG-03 | Multi-turn conversation supported | ✅ Full `messages` array converted and sent to LLM |
| PERS-02 | User message persisted to Postgres before LLM call | ✅ `createMessage()` called before `streamText()` |
| PERS-03 | Assistant response persisted in `onFinish` | ✅ `onFinish` callback with try/catch |
| RELY-01 | Backend retries LLM calls — minimum 2 retries with backoff | ✅ `maxRetries: 2` |
| RELY-02 | Retry does not duplicate messages | ✅ User message saved once outside retry loop |

---

## Commits

| Hash | Description |
|------|-------------|
| `4c920bd` | `feat(02-02): extend chat route handler with streaming, persistence, and retry` |

---

## Self-Check: PASSED

- `src/app/api/chat/route.ts` exists on disk: ✅
- `git log --oneline --all --grep="02-02"` returns 1 commit: ✅
- `npx tsc --noEmit` exits with code 0: ✅
- All 12 acceptance criteria verified: ✅
