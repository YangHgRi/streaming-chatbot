---
type: checkpoint:human-action
task: T2-04
plan: 02-drizzle-schema-and-client
status: pending
---

# Human Action Required: Configure .env.local and Run db:migrate

## What has been completed

All code files for Plan 02 have been created and committed:
- `drizzle.config.ts` — Drizzle configuration at project root
- `src/lib/db/schema.ts` — chats + messages table definitions
- `src/lib/db/index.ts` — globalThis singleton client
- `src/app/page.tsx` — DB smoke test Server Component
- `src/app/api/chat/route.ts` — Route stub with locked imports
- `drizzle/0000_purple_stephen_strange.sql` — generated migration SQL (committed)

## What you need to do

### Step 1: Create .env.local

Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
OPENAI_API_KEY=sk-your-real-key-here
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE
```

**Your Postgres credentials:** The connection attempt with `postgres:postgres` failed with "password authentication failed". You need to know your Postgres username, password, and database name.

Common formats:
- `postgresql://postgres:yourpassword@localhost:5432/chatbot`
- `postgresql://yourusername:yourpassword@localhost:5432/chatbot`

If the database `chatbot` doesn't exist yet, create it:
```sql
CREATE DATABASE chatbot;
```

### Step 2: Run migration

```bash
cd D:\code_space\streaming-chatbot
npm run db:migrate
```

Expected output:
```
Running migrations...
[✓] 0000_purple_stephen_strange.sql
```

### Step 3: Verify (optional)

Connect to your Postgres database and run:
```sql
\dt
```
Should show: `chats`, `messages`, `__drizzle_migrations` tables.

### Step 4: Test the app

```bash
npm run dev
```

Visit `http://localhost:3000` — should show "DB connection: OK" and "Chats in database: 0"

## After completing these steps

The SUMMARY.md has been created with T2-04 marked as pending human action. Once you have run `npm run db:migrate` successfully, Phase 1 is functionally complete.
