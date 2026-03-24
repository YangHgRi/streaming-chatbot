---
status: partial
phase: 02-core-loop
source: [02-VERIFICATION.md]
started: 2026-03-24T17:45:00Z
updated: 2026-03-24T17:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Streaming is truly chunked (not buffered)
expected: Open DevTools → Network tab → select the POST to `/api/chat` → confirm `Transfer-Encoding: chunked` and observe incremental data frames arriving before the response is complete
result: [pending]

### 2. Page reload restores full message history
expected: Send several messages, perform a hard reload (Ctrl+Shift+R), confirm all messages reappear in order with no duplicates
result: [pending]

### 3. Retry does not duplicate the user message in DB
expected: Simulate a transient failure (e.g., temporarily set an invalid API key to trigger a 401 or disconnect network mid-first-attempt), then confirm the `messages` table contains the user message exactly once
result: [pending]

### 4. onFinish DB failure is logged but does not crash
expected: Temporarily break the DB connection after the user message is saved, confirm the assistant stream still reaches the browser and the server emits the `[chat] CRITICAL` log line
result: [pending]

### 5. Error bubble appears after LLM failure
expected: Set `OPENAI_API_KEY` to an invalid value, send a message, confirm a red error bubble appears — not a blank screen or uncaught exception
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
