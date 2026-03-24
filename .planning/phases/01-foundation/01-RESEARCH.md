# Phase 1: Foundation — Research

**Phase:** 01-foundation
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Researched:** 2025-07-14
**Sources:** `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/phases/01-foundation/01-CONTEXT.md`, CLAUDE.md

---

## 1. Project State — What Exists

The project root (`D:\code_space\streaming-chatbot`) currently contains only:
- `.git/` — version control is initialized
- `.planning/` — all planning artifacts
- `CLAUDE.md` — project instructions and stack summary

**No Next.js app exists yet.** Phase 1 begins from a completely greenfield state. `create-next-app` must scaffold the project before any other work can happen.

---

## 2. Decisions Already Made (Do Not Re-decide)

From `01-CONTEXT.md` — these are locked:

| Decision | Detail |
|----------|--------|
| Bootstrap method | `create-next-app` CLI — not manual scaffolding |
| Router | App Router (not Pages Router) |
| Language | TypeScript |
| CSS | Tailwind CSS installed at `create-next-app` time |
| Database target | Local Postgres on `localhost` — not Docker, not Neon, not Supabase |
| ID generation | `crypto.randomUUID()` (Node.js built-in) — not `nanoid` |
| Drizzle config format | `drizzle.config.ts` (TypeScript) |
| ESLint | Next.js default |
| Migration strategy | `drizzle-kit generate` + `drizzle-kit migrate` — never `push` |

All `create-next-app` flag choices and directory layout details are at Claude's discretion, guided by `ARCHITECTURE.md`.

---

## 3. Pinned Package Versions

All versions are pre-researched and locked in `STACK.md`. Do not deviate.

### Runtime Dependencies

```bash
npm install \
  ai@6.0.137 \
  @ai-sdk/react@3.0.139 \
  @ai-sdk/openai@3.0.48 \
  drizzle-orm@0.45.1 \
  postgres@3.4.8 \
  zod@4.3.6
```

### Dev Dependencies

```bash
npm install -D \
  drizzle-kit@0.31.10 \
  dotenv
```

> **Note:** `next@16.2.1`, `react@19.2.4`, `react-dom@19.2.4`, and `typescript@6.0.2` are installed by `create-next-app` automatically. Do not install them manually.

### Version Compatibility Matrix

| Package | Compatible With | Critical Note |
|---------|-----------------|---------------|
| `ai@6.0.137` | `next@16`, `react@19`, `zod@4.x` | v6 is current `latest` — do not install v3/v4/v5 |
| `@ai-sdk/react@3.0.139` | `react@^18 \|\| ~19.x`, `ai@6.x` | Must match `ai` major; v3 ↔ ai v6 |
| `@ai-sdk/openai@3.0.48` | `ai@6.x` | Provider version tracks `ai` (ai v6 → @ai-sdk/* v3) |
| `drizzle-orm@0.45.1` | `postgres@3.x`, `node@18+` | Stable latest; `v1.0.0-beta.x` is NOT stable — avoid |
| `drizzle-kit@0.31.10` | `drizzle-orm@0.45.x` | Kit and ORM must stay in sync; 0.31.x ↔ 0.45.x |
| `postgres@3.4.8` | `drizzle-orm@0.45.1` | Preferred over `pg`; ESM-native, better TypeScript support |

### What NOT to Install

| Package | Why to Avoid |
|---------|--------------|
| `openai` (raw npm package) | `@ai-sdk/openai` wraps it; mixing both causes confusion |
| `drizzle-orm@1.0.0-beta.x` | Beta track — API unstable |
| `@types/pg` | Only needed with `pg` driver; project uses `postgres` |
| `nanoid` | `crypto.randomUUID()` is sufficient and has zero dependencies |

---

## 4. `create-next-app` Invocation

### Recommended Flags

```bash
npx create-next-app@16.2.1 streaming-chatbot \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --turbopack
```

**Flag rationale:**

| Flag | Reason |
|------|--------|
| `--typescript` | Required — project is TypeScript |
| `--tailwind` | Decision D-04 — install Tailwind at init time |
| `--eslint` | Decision: use Next.js default ESLint |
| `--app` | App Router is mandatory for this stack |
| `--src-dir` | Places all source under `src/` — aligns with `ARCHITECTURE.md` structure |
| `--import-alias "@/*"` | Standard path alias; matches `ARCHITECTURE.md` import patterns |
| `--turbopack` | Faster dev builds; no known conflicts with this stack |

> **Important:** Run `create-next-app` inside the project root to scaffold INTO the existing directory, or scaffold into a subdirectory and move files up. Since `.git` and `.planning` already exist, scaffold in the project root directly.

---

## 5. Canonical Directory Structure

From `ARCHITECTURE.md` — implemented in Phase 1:

```
src/
├── app/
│   ├── page.tsx                  # Phase 3 — stub only in Phase 1
│   ├── layout.tsx                # Created by create-next-app
│   └── api/
│       └── chat/
│           └── route.ts          # Phase 1 deliverable — stub with locked imports
├── lib/
│   └── db/
│       ├── index.ts              # Phase 1 deliverable — Drizzle client singleton
│       └── schema.ts             # Phase 1 deliverable — chats + messages tables
drizzle/
│   └── migrations/              # Phase 1 deliverable — generated + applied migrations
drizzle.config.ts                # Phase 1 deliverable
.env.local                       # Real env vars (gitignored)
.env.local.example               # Phase 1 deliverable — template, no real values
```

> `lib/db/queries.ts` and all `components/` are Phase 2 deliverables — do not create them in Phase 1.

---

## 6. Drizzle Client Singleton (`lib/db/index.ts`)

### Why the Singleton Matters

Next.js hot reload re-evaluates modules on every file save during development. Without a singleton guard, each reload creates a new `postgres()` connection pool while old pools linger open. After 10–15 minutes of development, Postgres hits its connection limit and queries start failing with `FATAL: too many connections`.

### Correct Implementation

Use the `postgres` driver (not `pg`):

```typescript
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
};

const client = globalForDb.db
  ? null
  : postgres(process.env.DATABASE_URL!, { max: 10 });

export const db =
  globalForDb.db ??
  drizzle(client!, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
```

### Key Implementation Details

- `globalThis` cast to `unknown` first, then to the typed shape — required to satisfy TypeScript strict mode
- `max: 10` caps the pool size; prevents runaway connections under load
- The guard (`process.env.NODE_ENV !== 'production'`) only caches on `globalThis` in development — in production (serverless), each cold start gets a fresh client, which is correct
- `import * as schema from './schema'` is required for the Drizzle Query API (relational queries) to work; safe to include even if only the SQL-like API is used

### Import Path

```typescript
import { db } from '@/lib/db';
```

---

## 7. Drizzle Schema (`lib/db/schema.ts`)

### Canonical Schema

From `ARCHITECTURE.md` — use `text` IDs with `crypto.randomUUID()`:

```typescript
// src/lib/db/schema.ts
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id:        text('id').primaryKey(),
  title:     text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
  'messages',
  {
    id:        text('id').primaryKey(),
    chatId:    text('chat_id')
                 .notNull()
                 .references(() => chats.id, { onDelete: 'cascade' }),
    role:      text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content:   text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    chatIdIdx: index('messages_chat_id_idx').on(table.chatId),
  }),
);

// Inferred TypeScript types — used throughout the app
export type Chat       = typeof chats.$inferSelect;
export type Message    = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

### Schema Design Decisions

| Decision | Reason |
|----------|--------|
| `text` IDs (not `uuid`) | `crypto.randomUUID()` generates UUID strings; `text` column is simpler and compatible |
| `role` as enum column | Prevents invalid roles at DB level; Drizzle infers `'user' \| 'assistant' \| 'system'` union type |
| `content` as `text` (not `jsonb`) | Text-only scope — no tool calls, no multi-part content; avoids serialisation complexity |
| `withTimezone: true` on timestamps | Best practice; avoids timezone ambiguity bugs |
| Foreign key with `onDelete: 'cascade'` | Deleting a chat automatically removes all its messages — no orphan rows |
| Index on `messages.chat_id` | Every message query filters by `chatId`; index is critical for response time |
| `updatedAt` on chats | Allows sidebar to sort by last activity without aggregating message timestamps |

### Generated SQL (for verification after migration)

```sql
CREATE TABLE chats (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'New Chat',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_chat_id_idx ON messages (chat_id);
```

---

## 8. Drizzle Configuration (`drizzle.config.ts`)

```typescript
// drizzle.config.ts (at project root, not inside src/)
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Configuration Notes

- `import 'dotenv/config'` at the top is required — `drizzle-kit` CLI runs outside Next.js and does not auto-load `.env.local`. Without this, `DATABASE_URL` is `undefined` and the CLI fails silently or with a cryptic error.
- `out: './drizzle'` puts migration files in a root-level `drizzle/` directory (not inside `src/`); commit this directory to git
- `dialect: 'postgresql'` is required in drizzle-kit v0.31+; omitting it causes a validation error
- `satisfies Config` provides type checking without widening the return type

---

## 9. Migration Workflow

### The Rule: `generate` + `migrate`, Never `push`

`drizzle-kit push` syncs the schema to the DB directly without creating migration files. It is convenient for throwaway experiments but **must never be the primary workflow** because:
- It leaves no migration history
- Fresh environments (new developer, CI, production) have no schema to apply
- The app crashes with `relation "chats" does not exist` on first DB query

### Commands

```bash
# Step 1: Generate migration SQL from schema changes
npx drizzle-kit generate

# Step 2: Apply pending migrations to the DB
npx drizzle-kit migrate

# Inspect the actual DB state (optional, browser UI)
npx drizzle-kit studio
```

### When to Run These

| Trigger | Action |
|---------|--------|
| Initial Phase 1 setup | Run `generate` then `migrate` after writing `schema.ts` |
| Any change to `schema.ts` | Run `generate` then `migrate` before running the app |
| CI / fresh environment setup | Run `migrate` only (migration files are already committed) |
| Schema drift suspected | Run `npx drizzle-kit check` — reports unapplied changes |

### Add npm Scripts

```json
// package.json (scripts section)
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"db:check": "drizzle-kit check"
```

### Commit the Migration Files

The `drizzle/` directory must be committed to git. It is the canonical migration history. `.gitignore` must NOT exclude it.

---

## 10. Environment Variable Wiring (INFRA-01)

### `.env.local.example` Template

```bash
# .env.local.example
# Copy this file to .env.local and fill in your values.
# Never commit .env.local — it is gitignored.

# OpenAI API key — get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...your-key-here...

# PostgreSQL connection string — local Postgres running on localhost
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
# Example: postgresql://postgres:postgres@localhost:5432/chatbot
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE
```

### Runtime Env Access Patterns

| Variable | Where Read | How |
|----------|------------|-----|
| `DATABASE_URL` | Server-side only — `lib/db/index.ts` | `process.env.DATABASE_URL!` |
| `OPENAI_API_KEY` | Server-side only — auto-read by `@ai-sdk/openai` | The `openai()` provider reads it automatically; no explicit `process.env` call needed in route handlers |

**Critical:** Never reference these variables in any client component (`"use client"`) or any file without a server-side guarantee. The `OPENAI_API_KEY` must never appear in the browser bundle.

### `.gitignore` Verification

After `create-next-app`, confirm `.env.local` is in `.gitignore` (it is by default). The example file IS committed; the real `.env.local` is NOT.

---

## 11. API Route Stub (`app/api/chat/route.ts`)

This stub is a hard dependency for Phase 2. The import paths must be locked in Phase 1 to prevent the most common AI SDK failure mode. The stub does not need to function — it just needs correct imports and the `dynamic` export.

### Correct Stub Implementation

```typescript
// src/app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

### Import Path Rules — Locked

| Symbol | Correct Import | Wrong Import |
|--------|---------------|--------------|
| `streamText` | `from 'ai'` | `from 'ai/react'` (client-only) |
| `openai` provider | `from '@ai-sdk/openai'` | `from 'ai'` |
| `useChat` (Phase 2) | `from 'ai/react'` | `from 'ai'` (server-only) |

### Why `export const dynamic = 'force-dynamic'`

Without this, Next.js may cache the route handler response. A cached response is delivered as a single payload — not streamed. The typewriter effect breaks. This export must be present on the chat route handler.

### What NOT to Use in Route Handlers

| Wrong Pattern | Why Wrong | Correct Pattern |
|---------------|-----------|-----------------|
| `new StreamingTextResponse(...)` | Removed in AI SDK v4 | `result.toDataStreamResponse()` |
| `export const runtime = 'edge'` | Drizzle + `postgres` driver requires Node.js `net` module; edge runtime lacks it | Omit `runtime` export; default is Node.js |
| `await result.text` before returning | Hangs until stream completes; defeats streaming | Call `result.toDataStreamResponse()` and return it immediately |
| `convertToCoreMessages(messages)` | Deprecated in AI SDK v6 | Pass `messages` directly — conversion is automatic |

---

## 12. Phase 1 Pitfalls (Relevant Subset)

These pitfalls from `PITFALLS.md` are specifically relevant to Phase 1 work:

### P1: Wrong Import Paths

**Risk:** TypeScript may not catch the error immediately. Symptoms appear at runtime or build time as `Cannot find module 'ai/react'` or silent streaming failure.

**Prevention:** The stub in Section 11 locks the imports. Do not change them without cross-referencing the split: `"ai"` = server core, `"ai/react"` = client hooks, `"@ai-sdk/openai"` = provider.

### P7: `drizzle-kit push` Instead of `generate` + `migrate`

**Risk:** No migration history. Fresh environments have no schema. App crashes on first query.

**Prevention:** The `db:generate` / `db:migrate` npm scripts (Section 9) make the correct workflow the default. Never run `drizzle-kit push` in this project.

### P8: Schema Drift

**Risk:** Adding a column to `schema.ts` without running `generate` + `migrate`. TypeScript says the column exists; Postgres does not. Runtime error: `column "X" does not exist`.

**Prevention:** Run `generate` + `migrate` immediately after every change to `schema.ts`. Run `db:check` to audit.

### P9: Connection Exhaustion

**Risk:** Hot reload creates new DB pools. After 15+ minutes, Postgres hits connection limit. Queries fail.

**Prevention:** The `globalThis` singleton in Section 6 is the complete fix. Implement it on the first commit.

### P11: Route Handler Not Streaming

**Risk:** Response arrives as one chunk, not as a stream. Typewriter effect breaks.

**Prevention:** `export const dynamic = 'force-dynamic'` in the route stub (Section 11). Verify with DevTools after Phase 2 implements the full handler.

### P12: Edge Runtime Incompatibility

**Risk:** If `export const runtime = 'edge'` is ever added to the chat route, the Drizzle + `postgres` driver crashes because the Edge runtime lacks Node.js `net` module.

**Prevention:** Never add `runtime = 'edge'` to any route that touches the DB. The default (no export) is Node.js runtime.

---

## 13. `tsconfig.json` Verification

`create-next-app` generates `tsconfig.json`. After scaffolding, verify:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- `"strict": true` is critical — it catches the `globalThis` type cast patterns and ensures `process.env.DATABASE_URL!` non-null assertions are visible
- `"@/*": ["./src/*"]` enables the `@/lib/db` import alias throughout the app

---

## 14. Success Criteria Verification Plan

### SC1: `npm run dev` starts cleanly

**How to verify:** After `npm install` and exporting both env vars, run `npm run dev`. No missing-module or missing-env errors in the terminal. App responds at `http://localhost:3000`.

**What can fail:** Missing `dotenv` dev dep (for drizzle.config.ts), wrong package versions causing peer dep conflicts, `DATABASE_URL` not set before `lib/db/index.ts` is evaluated.

### SC2: `drizzle-kit migrate` creates correct schema

**How to verify:**
```bash
npm run db:generate    # creates drizzle/migrations/*.sql
npm run db:migrate     # applies to local Postgres
```
Then connect to Postgres and inspect:
```sql
\d chats      -- verify columns: id, title, created_at, updated_at
\d messages   -- verify columns: id, chat_id, role, content, created_at + FK
\di           -- verify index: messages_chat_id_idx
```

**What can fail:** `dotenv/config` missing from `drizzle.config.ts` (DATABASE_URL undefined), `dialect` missing (drizzle-kit validation error), Postgres not running locally.

### SC3: Server Component query executes

**How to verify:** In `app/page.tsx` (or a temporary test page), add:
```typescript
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';

export default async function Page() {
  const allChats = await db.select().from(chats);
  return <pre>{JSON.stringify(allChats, null, 2)}</pre>;
}
```
If the page renders `[]` (empty array) without error, the DB connection and Drizzle client are wired correctly.

**What can fail:** `globalThis` singleton not attached (causes connection exhaustion on repeated hot reloads), `DATABASE_URL` pointing to a DB that doesn't have the schema applied yet.

### SC4: No hardcoded credentials

**How to verify:**
```bash
grep -r "sk-" src/           # should return zero results
grep -r "postgresql://" src/ # should return zero results (only in .env.local, not src/)
```

---

## 15. Recommended Task Sequence

Execute Phase 1 in this order to maintain a runnable state at each step:

1. **Scaffold the app** — run `create-next-app` with the flags from Section 4
2. **Install additional packages** — `ai`, `@ai-sdk/react`, `@ai-sdk/openai`, `drizzle-orm`, `postgres`, `zod`, `drizzle-kit`, `dotenv`
3. **Environment files** — create `.env.local` with real values, create `.env.local.example` with placeholder values
4. **`drizzle.config.ts`** — create at project root
5. **`lib/db/schema.ts`** — create chats + messages table definitions
6. **Run `npm run db:generate`** — generates the first migration SQL
7. **Run `npm run db:migrate`** — applies migration to local Postgres
8. **Verify migration** — connect to Postgres, confirm both tables and the index exist
9. **`lib/db/index.ts`** — create Drizzle singleton client
10. **Smoke test** — add a DB query in a Server Component, confirm it returns without error
11. **`app/api/chat/route.ts` stub** — create with locked imports and `dynamic = 'force-dynamic'`
12. **Final verification** — `npm run dev` starts cleanly; run SC4 grep checks; confirm `drizzle/` is committed

---

## 16. Key Facts for Planning

| Topic | Fact |
|-------|------|
| Greenfield state | Only `.git/` and `.planning/` exist; `create-next-app` runs first |
| `create-next-app` version | Pin to `16.2.1` to match the `next` package version |
| Tailwind | Installed by `create-next-app`; no post-install config needed |
| `dotenv` | Required as dev dep for `drizzle.config.ts`; `drizzle-kit` runs outside Next.js |
| `postgres` package | Used as the Drizzle driver; import is `import postgres from 'postgres'` (default export) |
| Drizzle client import | `import { drizzle } from 'drizzle-orm/postgres-js'` (not `'drizzle-orm'`) |
| No `queries.ts` in Phase 1 | DB query functions are a Phase 2 deliverable; Phase 1 only needs the schema and client |
| Route stub is a hard dependency | Phase 2 builds directly on `app/api/chat/route.ts`; wrong imports there break Phase 2 |
| Migration files must be committed | `drizzle/` goes in version control; `.gitignore` must not exclude it |
| `crypto.randomUUID()` availability | Available in Node.js 18+ with no import needed; confirmed for `next@16.2.1` / `node@18.18+` |

---

*Research for: Phase 1 — Foundation*
*Streaming Chatbot project*
*Researched: 2025-07-14*
