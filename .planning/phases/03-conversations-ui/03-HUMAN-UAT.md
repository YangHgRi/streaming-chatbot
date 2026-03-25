---
status: partial
phase: 03-conversations-ui
source: [03-VERIFICATION.md]
started: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar renders past chats and clicking loads message history
expected: Open browser → sidebar shows all past conversations → clicking any entry navigates to `/chat/<id>` and loads that conversation's full message history
result: [pending]

### 2. Rename conversation persists across full page reload
expected: Rename a chat via the inline edit → reload the full page → confirm the new title is still shown in the sidebar and in the chat header (confirms Postgres write via `updateChat`)
result: [pending]

### 3. Delete conversation removes it from sidebar and removes all messages from DB
expected: Delete a chat via the delete button → sidebar entry is gone → run `SELECT * FROM messages WHERE chat_id = '<deleted-id>'` → confirms 0 rows (CASCADE delete working)
result: [pending]

### 4. Mid-stream chat-switch does not leak tokens
expected: Start a slow LLM response in one chat → while it is still streaming, click a different sidebar entry → confirm no tokens from the old response appear in the new chat (validates `useEffect` `stop()` cleanup in `ChatInterface`)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
