---
wave: 2
depends_on:
  - 01-scaffold-and-packages.PLAN.md
files_modified:
  - drizzle.config.ts
  - src/lib/db/schema.ts
  - src/lib/db/index.ts
  - src/app/page.tsx
  - src/app/api/chat/route.ts
  - drizzle/migrations/ (generated files)
autonomous: true
requirements:
  - INFRA-01
  - INFRA-02
  - INFRA-03
  - INFRA-04
---

# Plan 02 — Drizzle Schema, Migrations, Client, and Route Stub

## Goal

Write `drizzle.config.ts`, define the `chats` and `messages` schema, run `generate` + `migrate` to commit the first migration, implement the `globalThis` singleton Drizzle client, smoke-test the DB connection from a Server Component, and lock in the `app/api/chat/route.ts` stub with correct imports. At the end of this plan all four Phase 1 success criteria are verifiable.

## must_haves

- `drizzle.config.ts` loads `dotenv/config` and references `DATABASE_URL` from environment
- `src/lib/db/schema.ts` defines `chats` and `messages` tables with the exact columns, foreign key constraint, and `messages_chat_id_idx` index
- `drizzle/` directory exists with at least one `.sql` migration file committed to git
- `src/lib/db/index.ts` implements the `globalThis` singleton pattern with `max: 10` connection cap
- `src/app/page.tsx` runs a Server Component query against Postgres and renders without error
- `src/app/api/chat/route.ts` stub has `streamText` from `"ai"`, `openai` from `"@ai-sdk/openai"`, and `export const dynamic = 'force-dynamic'`
- No hardcoded values for `OPENAI_API_KEY` or `DATABASE_URL` anywhere in `src/`
- `src/app/api/chat/route.ts` does NOT import from `'ai/react'` (server route must only use `'ai'` and `'@ai-sdk/openai'`)

## Context

All packages are installed (Plan 01). This plan writes every Drizzle-related file and runs the migration workflow. The project is greenfield — no existing `src/lib/` directory. The local Postgres instance must be running with a database created (e.g., `chatbot`) before running migrations. `DATABASE_URL` must be set in `.env.local`.

---

## Wave 1 — Drizzle Configuration

<task id="T2-01" name="Create drizzle.config.ts at project root">
  <read_first>
    - D:\code_space\streaming-chatbot\package.json (confirm drizzle-kit and dotenv are in devDependencies from Plan 01)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 8: Drizzle Configuration)
    - D:\code_space\streaming-chatbot\.env.local.example (confirm DATABASE_URL format)
  </read_first>

  <action>
    Create the file `drizzle.config.ts` at `D:\code_space\streaming-chatbot\drizzle.config.ts` (project root, NOT inside `src/`) with this exact content:

    ```typescript
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

    Explanation of each field:
    - `import 'dotenv/config'` — REQUIRED: `drizzle-kit` CLI runs outside Next.js; without this import, `process.env.DATABASE_URL` is `undefined` and migrations fail with a cryptic error
    - `schema: './src/lib/db/schema.ts'` — path to the schema file that will be created in T2-02
    - `out: './drizzle'` — migration SQL files will be written to `./drizzle/` at project root (not inside `src/`)
    - `dialect: 'postgresql'` — REQUIRED in drizzle-kit v0.31+; omitting causes a validation error
    - `dbCredentials.url: process.env.DATABASE_URL!` — reads the connection string from `.env.local` via dotenv
    - `satisfies Config` — provides compile-time type checking without widening the return type

    The `drizzle.config.ts` file is placed at the project root alongside `package.json` and `next.config.ts`.
  </action>

  <acceptance_criteria>
    - `drizzle.config.ts` exists at `D:\code_space\streaming-chatbot\drizzle.config.ts`
    - `drizzle.config.ts` contains `import 'dotenv/config'` (first line)
    - `drizzle.config.ts` contains `dialect: 'postgresql'`
    - `drizzle.config.ts` contains `schema: './src/lib/db/schema.ts'`
    - `drizzle.config.ts` contains `out: './drizzle'`
    - `drizzle.config.ts` contains `process.env.DATABASE_URL`
    - `drizzle.config.ts` does NOT contain any hardcoded connection string (no `postgresql://` literal)
  </acceptance_criteria>
</task>

---

## Wave 2 — Schema Definition (INFRA-02)

<task id="T2-02" name="Create src/lib/db/schema.ts with chats and messages tables">
  <read_first>
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 7: Drizzle Schema — exact column types, constraints, index definition)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 7: Drizzle Schema — schema design rationale, formerly in ARCHITECTURE.md)
    - D:\code_space\streaming-chatbot\drizzle.config.ts (confirm schema path matches)
  </read_first>

  <action>
    First, create the directory `src/lib/db/` if it does not exist.

    Create the file `src/lib/db/schema.ts` at `D:\code_space\streaming-chatbot\src\lib\db\schema.ts` with this exact content:

    ```typescript
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

    Schema design rules (do not deviate):
    - IDs are `text` (not `uuid`) — `crypto.randomUUID()` returns a UUID string; `text` column is simpler and fully compatible
    - `role` uses `{ enum: ['user', 'assistant', 'system'] }` — prevents invalid values at DB level; Drizzle infers the union type automatically
    - `content` is `text` (not `jsonb`) — text-only scope for this project; no tool call payloads
    - Both timestamps use `{ withTimezone: true }` — avoids timezone ambiguity bugs
    - Foreign key uses `{ onDelete: 'cascade' }` — deleting a chat automatically removes all its messages
    - Index named `messages_chat_id_idx` on `messages.chatId` — every message query filters by `chatId`; index is critical for response time
    - `updatedAt` on `chats` — allows sorting sidebar by last activity without aggregating message timestamps
    - Exported inferred types (`Chat`, `Message`, `NewMessage`) — used in Phase 2 query functions

    The import path `drizzle-orm/pg-core` (not `drizzle-orm`) is correct — this is the Postgres-specific submodule.
  </action>

  <acceptance_criteria>
    - `src/lib/db/schema.ts` exists
    - `src/lib/db/schema.ts` contains `import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'`
    - `src/lib/db/schema.ts` contains `export const chats = pgTable('chats',`
    - `src/lib/db/schema.ts` contains `export const messages = pgTable(`
    - `src/lib/db/schema.ts` contains `references(() => chats.id, { onDelete: 'cascade' })`
    - `src/lib/db/schema.ts` contains `index('messages_chat_id_idx').on(table.chatId)`
    - `src/lib/db/schema.ts` contains `{ enum: ['user', 'assistant', 'system'] }`
    - `src/lib/db/schema.ts` contains `withTimezone: true` (at least once)
    - `src/lib/db/schema.ts` contains `export type Chat`
    - `src/lib/db/schema.ts` contains `export type Message`
    - `src/lib/db/schema.ts` contains `export type NewMessage`
  </acceptance_criteria>
</task>

---

## Wave 3 — Generate and Apply Migrations (INFRA-03)

<task id="T2-03" name="Run drizzle-kit generate to create the first migration SQL">
  <read_first>
    - D:\code_space\streaming-chatbot\drizzle.config.ts (must exist from T2-01)
    - D:\code_space\streaming-chatbot\src\lib\db\schema.ts (must exist from T2-02)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 9: Migration Workflow, Section 14: SC2 verification)
  </read_first>

  <action>
    Ensure `DATABASE_URL` is set in `.env.local` at the project root before running. The `.env.local` file must contain a valid connection string pointing to a running local Postgres instance, e.g.:
    ```
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot
    ```

    Run from `D:\code_space\streaming-chatbot`:
    ```
    npm run db:generate
    ```

    This command runs `drizzle-kit generate` which:
    1. Reads `drizzle.config.ts` (which loads `.env.local` via `dotenv/config`)
    2. Reads `src/lib/db/schema.ts`
    3. Computes the diff (from nothing → the chats + messages schema)
    4. Writes one or more `.sql` files into `drizzle/` (e.g., `drizzle/0000_initial_schema.sql`)

    Expected output: Something like:
    ```
    1 migration(s) generated
    ```

    The generated SQL file must contain (confirm by reading it):
    - `CREATE TABLE "chats"` with `id`, `title`, `created_at`, `updated_at` columns
    - `CREATE TABLE "messages"` with `id`, `chat_id`, `role`, `content`, `created_at` columns
    - `REFERENCES "chats"("id") ON DELETE cascade`
    - `CREATE INDEX "messages_chat_id_idx"`

    Do NOT modify the generated SQL file. It is auto-generated and must be committed as-is.
  </action>

  <acceptance_criteria>
    - `drizzle/` directory exists after running the command
    - At least one `.sql` file exists inside `drizzle/` (e.g., `drizzle/0000_*.sql`)
    - The SQL file contains `CREATE TABLE "chats"` or `CREATE TABLE chats`
    - The SQL file contains `CREATE TABLE "messages"` or `CREATE TABLE messages`
    - The SQL file contains `ON DELETE cascade` (foreign key constraint)
    - The SQL file contains `CREATE INDEX` and `messages_chat_id_idx`
    - A `drizzle/meta/` directory exists (drizzle-kit snapshot tracking)
  </acceptance_criteria>
</task>

<task id="T2-04" name="Run drizzle-kit migrate to apply migration to local Postgres">
  <read_first>
    - D:\code_space\streaming-chatbot\drizzle (read the directory to confirm T2-03 created migrations)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 9: migration commands and Section 14: SC2 verification)
  </read_first>

  <action>
    Ensure local Postgres is running and `DATABASE_URL` in `.env.local` points to a valid, accessible database.

    Run from `D:\code_space\streaming-chatbot`:
    ```
    npm run db:migrate
    ```

    This command runs `drizzle-kit migrate` which:
    1. Reads `drizzle.config.ts` (loads `.env.local` via `dotenv/config`)
    2. Connects to Postgres using `DATABASE_URL`
    3. Creates a `__drizzle_migrations` table in the database if it does not exist
    4. Applies any unapplied migration SQL files from `drizzle/`

    Expected terminal output: Something like:
    ```
    Running migrations...
    [✓] 0000_initial_schema.sql
    ```

    After `db:migrate` completes, verify the schema was applied by connecting to Postgres and running:
    ```sql
    \dt
    ```
    This should list `chats`, `messages`, and `__drizzle_migrations` tables.

    Also verify:
    ```sql
    \d chats
    ```
    Expected columns: `id` (text, PK), `title` (text, not null, default 'New Chat'), `created_at` (timestamptz, not null), `updated_at` (timestamptz, not null)

    ```sql
    \d messages
    ```
    Expected columns: `id` (text, PK), `chat_id` (text, not null, FK → chats.id on delete cascade), `role` (text, not null), `content` (text, not null), `created_at` (timestamptz, not null)

    ```sql
    \di
    ```
    Must include `messages_chat_id_idx` index on `messages.chat_id`.
  </action>

  <acceptance_criteria>
    - `npm run db:migrate` exits with code 0 (no error)
    - Connecting to the Postgres database, running `\dt` shows `chats` table
    - Connecting to the Postgres database, running `\dt` shows `messages` table
    - Connecting to the Postgres database, `\di` shows `messages_chat_id_idx`
    - `drizzle/` directory is NOT in `.gitignore` (migration files must be committable)
  </acceptance_criteria>
</task>

---

## Wave 4 — Drizzle Client Singleton (INFRA-04)

<task id="T2-05" name="Create src/lib/db/index.ts with globalThis singleton">
  <read_first>
    - D:\code_space\streaming-chatbot\src\lib\db\schema.ts (must exist from T2-02 — this file is imported by index.ts)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 6: Drizzle Client Singleton — complete implementation with comments)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 12: Phase 1 Pitfalls, P9: Connection Exhaustion — explains why singleton is mandatory)
  </read_first>

  <action>
    Create the file `src/lib/db/index.ts` at `D:\code_space\streaming-chatbot\src\lib\db\index.ts` with this exact content:

    ```typescript
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

    Explanation of every line:
    - `import { drizzle } from 'drizzle-orm/postgres-js'` — correct submodule for the `postgres` driver (NOT `drizzle-orm/pg` which is for the `pg` driver)
    - `import postgres from 'postgres'` — default export from the `postgres@3.4.8` package
    - `import * as schema from './schema'` — required for Drizzle Query API (relational queries) to work; safe to include even when using SQL-like API
    - `globalThis as unknown as { db: ... }` — TypeScript strict mode requires the `unknown` cast before the typed cast; this is the correct pattern
    - `{ max: 10 }` — caps the connection pool at 10; prevents runaway connections under load
    - `globalForDb.db ?? drizzle(client!, { schema })` — reuses existing client if already initialized by a previous hot-reload cycle
    - `if (process.env.NODE_ENV !== 'production')` — singleton is only stored on globalThis in development; in production (serverless), each cold start gets a fresh client, which is the correct behavior

    Import this client as:
    ```typescript
    import { db } from '@/lib/db';
    ```

    Do NOT export `sql` (the postgres connection). Only export `db` (the Drizzle instance).
  </action>

  <acceptance_criteria>
    - `src/lib/db/index.ts` exists
    - `src/lib/db/index.ts` contains `import { drizzle } from 'drizzle-orm/postgres-js'`
    - `src/lib/db/index.ts` contains `import postgres from 'postgres'`
    - `src/lib/db/index.ts` contains `globalThis as unknown as`
    - `src/lib/db/index.ts` contains `max: 10`
    - `src/lib/db/index.ts` contains `process.env.NODE_ENV !== 'production'`
    - `src/lib/db/index.ts` contains `export const db =`
    - `src/lib/db/index.ts` does NOT contain any hardcoded connection string (`postgresql://` must not appear)
    - `src/lib/db/index.ts` contains `import * as schema from './schema'`
  </acceptance_criteria>
</task>

---

## Wave 5 — Smoke Test DB Connection and Lock Route Stub Imports

<task id="T2-06" name="Add DB smoke test to src/app/page.tsx (INFRA-04 verification)">
  <read_first>
    - D:\code_space\streaming-chatbot\src\app\page.tsx (current content from create-next-app — read before overwriting)
    - D:\code_space\streaming-chatbot\src\lib\db\index.ts (must exist from T2-05)
    - D:\code_space\streaming-chatbot\src\lib\db\schema.ts (must exist from T2-02 — need chats export)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 14: SC3 Server Component query)
  </read_first>

  <action>
    Replace the contents of `src/app/page.tsx` with a minimal Server Component that exercises the Drizzle client and DB schema. This verifies INFRA-04 (app runs after setting env vars) and is the SC3 smoke test for Phase 1.

    Write `src/app/page.tsx` with this content:

    ```typescript
    import { db } from '@/lib/db';
    import { chats } from '@/lib/db/schema';

    export default async function HomePage() {
      const allChats = await db.select().from(chats);

      return (
        <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
          <h1>Streaming Chatbot</h1>
          <p>DB connection: OK</p>
          <p>Chats in database: {allChats.length}</p>
          <pre style={{ fontSize: '0.8rem', color: '#888' }}>
            {JSON.stringify(allChats, null, 2)}
          </pre>
        </main>
      );
    }
    ```

    This page:
    - Is a Server Component (no `"use client"` directive — correct)
    - Imports `db` from `@/lib/db` (exercises the singleton client)
    - Imports `chats` from `@/lib/db/schema` (exercises the schema)
    - Runs `db.select().from(chats)` — a real DB query against the migrated table
    - Renders `allChats.length` — if the page renders `0` without an error, the DB connection, schema, and Drizzle client are all working

    Note: This is a temporary smoke-test implementation. Phase 3 will replace this with the real root page that creates a chat and redirects to `/chat/<id>`. Do NOT build Phase 3 features here — keep it minimal.
  </action>

  <acceptance_criteria>
    - `src/app/page.tsx` contains `import { db } from '@/lib/db'`
    - `src/app/page.tsx` contains `import { chats } from '@/lib/db/schema'`
    - `src/app/page.tsx` contains `db.select().from(chats)`
    - `src/app/page.tsx` does NOT contain `"use client"` (must be a Server Component)
    - `src/app/page.tsx` does NOT contain any hardcoded connection string
    - With `DATABASE_URL` and `OPENAI_API_KEY` set and Postgres running, visiting `http://localhost:3000` renders `DB connection: OK` without a 500 error
  </acceptance_criteria>
</task>

<task id="T2-07" name="Create src/app/api/chat/route.ts stub with locked imports">
  <read_first>
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 11: API Route Stub — exact import paths, what NOT to use)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 12: Phase 1 Pitfalls, P1: Wrong Import Paths — the most common AI SDK failure mode)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-CONTEXT.md (Specifics section — route stub is a hard dependency for Phase 2)
  </read_first>

  <action>
    Create the directory `src/app/api/chat/` if it does not exist.

    Create the file `src/app/api/chat/route.ts` at `D:\code_space\streaming-chatbot\src\app\api\chat\route.ts` with this exact content:

    ```typescript
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

    Import path rules — these are LOCKED and must not be changed:

    | Symbol | Correct import | Wrong import |
    |--------|---------------|--------------|
    | `streamText` | `from 'ai'` | `from 'ai/react'` (client-only module) |
    | `openai` provider | `from '@ai-sdk/openai'` | `from 'ai'` (core only, no providers) |

    Other rules:
    - `export const dynamic = 'force-dynamic'` MUST be present — without it, Next.js may cache the route handler response, breaking streaming (the typewriter effect would show all text at once)
    - Do NOT add `export const runtime = 'edge'` — the edge runtime lacks Node.js `net` module; the Drizzle + `postgres` driver requires the full Node.js runtime
    - Do NOT use `new StreamingTextResponse(...)` — removed in AI SDK v4+; `result.toDataStreamResponse()` is the correct API
    - Do NOT call `convertToCoreMessages(messages)` — deprecated in AI SDK v6; pass `messages` directly
    - Do NOT `await result.text` before returning — this hangs until the stream completes, defeating streaming
    - The `openai` model string `'gpt-4o-mini'` is the default; do not change it in Phase 1

    This stub is complete for Phase 1. Phase 2 will add `chatId` from the request body, the user message DB save, and the `onFinish` persistence callback.
  </action>

  <acceptance_criteria>
    - `src/app/api/chat/route.ts` exists
    - `src/app/api/chat/route.ts` contains `import { streamText } from 'ai'`
    - `src/app/api/chat/route.ts` contains `import { openai } from '@ai-sdk/openai'`
    - `src/app/api/chat/route.ts` contains `export const dynamic = 'force-dynamic'`
    - `src/app/api/chat/route.ts` contains `result.toDataStreamResponse()`
    - `src/app/api/chat/route.ts` does NOT contain `StreamingTextResponse`
    - `src/app/api/chat/route.ts` does NOT contain `convertToCoreMessages`
    - `src/app/api/chat/route.ts` does NOT contain `export const runtime = 'edge'`
    - `src/app/api/chat/route.ts` does NOT contain `from 'ai/react'` (wrong module for server code)
    - Running `npx tsc --noEmit` exits with code 0 (TypeScript compiles without errors)
  </acceptance_criteria>
</task>

---

## Wave 6 — Final Phase 1 Verification

<task id="T2-08" name="Final verification — run all Phase 1 success criteria checks">
  <read_first>
    - D:\code_space\streaming-chatbot\.planning\ROADMAP.md (Phase 1 Success Criteria — 4 criteria; STATE.md is generated during execution, use ROADMAP.md Phase 1 Success Criteria for verification)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 14: Success Criteria Verification Plan — SC1–SC4)
  </read_first>

  <action>
    Run through each Phase 1 success criterion in order. All four must pass before Phase 1 is considered complete.

    **SC1: `npm run dev` starts cleanly (INFRA-04)**

    With `.env.local` containing valid `OPENAI_API_KEY` and `DATABASE_URL`:
    ```
    npm run dev
    ```
    Expected: Terminal prints `Ready in Xms` or `Ready` and `http://localhost:3000`. No error about missing modules, missing env vars, or TypeScript errors. Visit `http://localhost:3000` — page renders.

    **SC2: `drizzle-kit migrate` creates correct schema (INFRA-03)**

    Schema was already applied in T2-04. Verify the tables exist by connecting to Postgres:
    - `chats` table: columns `id` (text PK), `title` (text, default 'New Chat'), `created_at` (timestamptz), `updated_at` (timestamptz)
    - `messages` table: columns `id` (text PK), `chat_id` (text, FK → chats.id on delete cascade), `role` (text), `content` (text), `created_at` (timestamptz)
    - Index: `messages_chat_id_idx` on `messages(chat_id)`

    **SC3: Server Component query executes without error (INFRA-04)**

    With dev server running, visit `http://localhost:3000`. The page must:
    - Render `DB connection: OK` (confirming the query ran)
    - Show `Chats in database: 0` (or a number if test rows exist)
    - NOT show a 500 error or "Application error: a client-side exception has occurred"

    **SC4: No hardcoded credentials (INFRA-01)**

    Run these checks (all must return zero results):
    ```
    grep -r "sk-" src/
    grep -r "postgresql://" src/
    grep -r "DATABASE_URL=" src/
    grep -r "OPENAI_API_KEY=" src/
    ```
    All four commands must return no matches. Environment variables are read from `.env.local` at runtime, not embedded in source code.

    If any check fails, fix the root cause before marking Phase 1 complete.
  </action>

  <acceptance_criteria>
    - `npm run dev` exits 0 (or stays running as expected) with no error messages in the first 5 seconds
    - `http://localhost:3000` returns HTTP 200 and renders text containing `DB connection`
    - Postgres `\dt` shows both `chats` and `messages` tables
    - Postgres `\di` shows `messages_chat_id_idx`
    - `grep -r "sk-" src/` returns zero matches
    - `grep -r "postgresql://" src/` returns zero matches
    - `drizzle/` directory exists and is NOT in `.gitignore`
    - `npx tsc --noEmit` exits with code 0
  </acceptance_criteria>
</task>

---

## Verification Criteria

After all tasks in this plan are complete, all four Phase 1 INFRA requirements are satisfied:

| Requirement | Satisfied By |
|-------------|--------------|
| INFRA-01 — env vars from environment, not hardcoded | T2-01 (`DATABASE_URL` from env in drizzle.config.ts), T2-05 (`DATABASE_URL` from env in index.ts), T2-08 SC4 grep checks |
| INFRA-02 — Drizzle schema with chats + messages tables | T2-02 (schema.ts), T2-03 + T2-04 (generate + migrate) |
| INFRA-03 — migrations via generate + migrate, not push | T2-03 (`npm run db:generate`), T2-04 (`npm run db:migrate`), drizzle/ files committed |
| INFRA-04 — `npm run dev` starts after setting env vars | T2-06 (smoke test page), T2-07 (route stub), T2-08 SC1 + SC3 verification |

**File checklist — everything that must exist after Plan 02 completes:**
- `drizzle.config.ts` — at project root
- `src/lib/db/schema.ts` — chats + messages tables
- `src/lib/db/index.ts` — globalThis singleton client
- `src/app/page.tsx` — Server Component DB smoke test
- `src/app/api/chat/route.ts` — stub with locked imports
- `drizzle/` — migration SQL files committed to git
- `.env.local.example` — template (from Plan 01)
- `package.json` — all pinned deps + db:* scripts (from Plan 01)
