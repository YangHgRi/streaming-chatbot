---
status: passed
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-03-24T14:34:39Z
updated: 2026-03-24T15:01:45Z
---

## Current Test

approved by developer 2026-03-24

## Tests

### 1. Apply Drizzle migration to Postgres (SC2 / INFRA-03)
expected: `npm run db:migrate` exits 0; `chats`, `messages`, and `__drizzle_migrations` tables exist in the database; `messages_chat_id_idx` index is present; FK constraint `messages.chat_id → chats.id ON DELETE cascade` is present
result: passed

### 2. Dev server starts and DB smoke test passes (SC1 + SC3 / INFRA-04)
expected: `npm run dev` starts without error; visiting http://localhost:3000 shows "DB connection: OK" and "Chats in database: 0" (or a count); no unhandled exception in the terminal
result: passed

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### To complete these tests

1. Create `.env.local` from `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in:
   - `OPENAI_API_KEY=sk-...` (from https://platform.openai.com/api-keys)
   - `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/chatbot`

2. Ensure the Postgres database exists:
   ```bash
   createdb chatbot
   # or: psql -U postgres -c "CREATE DATABASE chatbot;"
   ```

3. Run migration:
   ```bash
   npm run db:migrate
   ```

4. Verify in Postgres:
   ```sql
   \dt          -- should list: chats, messages, __drizzle_migrations
   \d messages  -- should show FK → chats.id ON DELETE cascade
   \di          -- should include messages_chat_id_idx
   ```

5. Smoke test:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 → "DB connection: OK"
