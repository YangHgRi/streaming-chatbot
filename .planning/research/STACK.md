# Stack Research

**Domain:** Streaming Chatbot — Next.js App Router + Vercel AI SDK + OpenAI + Drizzle ORM + Postgres
**Researched:** 2025-07-14
**Confidence:** HIGH (all versions verified against live npm registry; API patterns verified against current official docs)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `next` | `16.2.1` | React framework with App Router, Route Handlers, RSC | Industry standard for full-stack React; Route Handlers integrate natively with Vercel AI SDK streaming via Web Streams API |
| `react` / `react-dom` | `19.2.4` | UI rendering | Next.js 16 ships React 19 by default; required peer dep |
| `ai` | `6.0.137` | Vercel AI SDK core — `streamText`, `generateText`, `generateObject` | The canonical npm package for server-side AI streaming primitives; v6 is current `latest` tag |
| `@ai-sdk/react` | `3.0.139` | Vercel AI SDK UI hooks — `useChat`, `useCompletion`, `useObject` | React-specific client hooks; split from core in v4+; must install separately |
| `@ai-sdk/openai` | `3.0.48` | OpenAI provider for Vercel AI SDK | First-party Vercel provider wrapper; type-safe, handles auth, model selection for GPT-4o/GPT-4o-mini |
| `drizzle-orm` | `0.45.1` | TypeScript-first ORM for Postgres | Lightweight (~57KB), TypeScript-native schema-as-code, no code generation step, fast cold starts |
| `postgres` | `3.4.8` | Postgres driver (recommended over `pg`) | Modern ESM-native driver; better TypeScript support, built-in connection pooling, works in serverless |
| `zod` | `4.3.6` | Schema validation | Peer dep of `ai` package; required for structured output (`generateObject`); validates env vars and API inputs |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-kit` | `0.31.10` | CLI for schema diffing, migration generation, Drizzle Studio | Always — used as dev dep for `drizzle-kit generate` and `drizzle-kit migrate` |
| `dotenv` | `^16` | Load `.env` into process during migrations | Required for `drizzle-kit` CLI to read `DATABASE_URL` outside Next.js |
| `@types/pg` | `8.20.0` | TypeScript types for `pg` | Only needed if using `pg` driver instead of `postgres`; skip if using `postgres` package |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `drizzle-kit` | Schema migrations & Drizzle Studio UI | `npx drizzle-kit generate` → creates SQL files; `npx drizzle-kit migrate` → applies them; `npx drizzle-kit studio` → browser UI |
| `typescript` | `6.0.2` | Type-checking | Ships with Next.js project; add `tsconfig.json` strict mode |
| `eslint` | Linting | `next lint` uses the built-in Next.js ESLint config |

---

## Installation

```bash
# Core runtime
npm install next@16.2.1 react@19.2.4 react-dom@19.2.4

# Vercel AI SDK (3 packages — all required)
npm install ai@6.0.137 @ai-sdk/react@3.0.139 @ai-sdk/openai@3.0.48

# Database
npm install drizzle-orm@0.45.1 postgres@3.4.8

# Validation (also a peer dep of ai)
npm install zod@4.3.6

# Dev deps — migration tooling
npm install -D drizzle-kit@0.31.10 typescript@6.0.2 dotenv
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `postgres` driver | `pg` + `@types/pg` | If existing codebase already uses `pg`; `pg` v8.20.0 is stable but uses CommonJS, lacks native ESM; slightly more verbose with Drizzle |
| `drizzle-orm` | Prisma | If the team wants a higher-level abstraction, has a larger codebase, or is used to Prisma-style schema language — Prisma 7 is much improved (~1.6MB bundle) but still slower cold starts than Drizzle |
| `zod` v4 | Zod v3 | Zod v3 still works as a peer dep (`ai` accepts `^3.25.76 \|\| ^4.1.8`); prefer v4 for new projects — same API surface for basic use, improved performance |
| AI SDK `@ai-sdk/openai` | Raw `openai` npm package (v6.32.0) | Use raw `openai` SDK only if bypassing Vercel AI SDK entirely; do NOT mix both — `@ai-sdk/openai` wraps the raw SDK for AI SDK compatibility |
| Route Handler (`app/api/chat/route.ts`) | React Server Action | Route Handlers are the proven pattern for `useChat` streaming; Server Actions with AI SDK are an experimental v6 feature — avoid for a demo with a 1-week timeline |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `StreamingTextResponse` (from `ai` package) | Removed in AI SDK v4 — was v3's streaming helper; causes runtime errors in v4+ | `streamText(...).toDataStreamResponse()` |
| `LangchainAdapter` / `OpenAIStream` helpers | Removed/deprecated in AI SDK v4; these were compatibility shims | `streamText` from `ai` + `@ai-sdk/openai` provider |
| `createParser` / `eventsource-parser` manually | Not needed — AI SDK v4+ handles SSE parsing internally | `streamText` handles the full stream lifecycle |
| `convertToCoreMessages()` | Deprecated in AI SDK v6 — message conversion to `CoreMessage` format is now automatic | Pass `messages` from `useChat` directly to `streamText` |
| `baseUrl` option on provider | Renamed to `baseURL` in AI SDK v4 — using old name silently fails | `createOpenAI({ baseURL: '...' })` |
| `Anthropic` / `Google` facade constructors | Removed in AI SDK v4 — facade pattern deleted | `createAnthropic()` / `createGoogleGenerativeAI()` (not needed for OpenAI-only project) |
| Prisma (as alternative to Drizzle) | Not wrong, but Prisma has heavier cold starts and needs its own migration CLI; Drizzle is already chosen | Stick with `drizzle-orm` |
| `drizzle-orm` v1.0.0-beta.x | In beta — API may change; `latest` tag is `0.45.1` stable | `drizzle-orm@0.45.1` (stable latest) |
| Mixing `openai` npm package + `@ai-sdk/openai` | Double-installing both is waste and causes confusion about which client is active | Use only `@ai-sdk/openai` |

---

## Vercel AI SDK — Streaming Architecture

### How Streaming Works (AI SDK v6 / `ai@6.x`)

The SDK ships three conceptual layers:

```
[ai core]          streamText(), generateText(), generateObject()
[provider]         @ai-sdk/openai  →  GPT-4o / GPT-4o-mini
[ui hooks]         @ai-sdk/react   →  useChat(), useCompletion()
```

**Route Handler pattern (canonical for `useChat`):**

```ts
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages,                         // UIMessage[] from useChat — no conversion needed
    system: 'You are a helpful assistant.',
  });

  return result.toDataStreamResponse(); // returns a Web Response with SSE stream
}
```

**Client hook (`useChat`):**

```ts
// app/components/Chat.tsx
'use client';
import { useChat } from '@ai-sdk/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',   // points to the Route Handler above
  });
  // ...
}
```

**Key points:**
- `streamText` returns a `StreamTextResult` — call `.toDataStreamResponse()` to produce a `Response` for the Route Handler return value
- `useChat` consumes the data stream protocol automatically; no custom fetch needed
- `messages` from `useChat` can be passed directly to `streamText` in AI SDK v6 — automatic `UIMessage → CoreMessage` conversion is built-in
- Multi-turn context: pass the full `messages` array on every call; the SDK sends the whole history to the LLM

**`streamText` key options:**
```ts
streamText({
  model: openai('gpt-4o-mini'),
  messages,
  system: '...',          // system prompt
  maxTokens: 2048,        // optional cap
  temperature: 0.7,       // optional
  onFinish: async ({ text, usage }) => {
    // persist completed message to DB here
  },
})
```

---

## Drizzle ORM Setup with Postgres

### Driver Choice: `postgres` over `pg`

Use the `postgres` npm package (not `pg`). Drizzle's official docs favor it for new projects:

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

### Schema (SQL-like style — recommended)

```ts
// src/db/schema.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),  // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Drizzle Config

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',            // migration files go here
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Migration Commands

```bash
npx drizzle-kit generate    # diff schema → generate SQL migration files in ./drizzle
npx drizzle-kit migrate     # apply pending migrations to the DB
npx drizzle-kit studio      # open browser-based data explorer at localhost:4983
```

### Query Style Recommendation: **SQL-like (core API) for simple CRUD; Query API for relations**

Drizzle has two query styles:

**SQL-like core API** (recommended default — explicit, composable, clear SQL mapping):
```ts
// SELECT
const allChats = await db.select().from(chats).orderBy(desc(chats.createdAt));

// INSERT
const [chat] = await db.insert(chats).values({ title: 'My Chat' }).returning();

// UPDATE
await db.update(chats).set({ title: 'New Title' }).where(eq(chats.id, chatId));

// DELETE
await db.delete(messages).where(eq(messages.chatId, chatId));
```

**Query (Relational) API** — use when fetching nested relations in one call:
```ts
// Fetch chat with all its messages in one query
const chatWithMessages = await db.query.chats.findFirst({
  where: eq(chats.id, chatId),
  with: { messages: { orderBy: asc(messages.createdAt) } },
});
```

**Recommendation for this project:** Use SQL-like core API for 80% of operations (simple CRUD on chats/messages). Reach for the Query API when you need a chat with its messages in a single call. Do not pick one exclusively — they compose freely.

---

## Stack Patterns by Variant

**Persisting AI responses (streaming + DB write):**
- Use `onFinish` callback in `streamText` to write the completed assistant message to Postgres after the stream ends
- Do NOT write to DB mid-stream (risks partial records if client disconnects)

**Connection pooling for serverless/Next.js:**
- Use a singleton Drizzle client with a module-level `postgres()` instance — Next.js module caching prevents reconnection on every request
- For PgBouncer/Neon/Supabase pooler: add `?pgbouncer=true` or use the pooled connection string

**Model selection:**
- Default: `openai('gpt-4o-mini')` — fast, cheap, sufficient for demo
- Premium: `openai('gpt-4o')` — swap the string, no other code changes

**Environment variables:**
```bash
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost:5432/chatdb
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `ai@6.0.137` | `next@16`, `react@19`, `zod@4.x` or `^3.25` | `ai` v6 is the `latest` tag; peer dep on zod accepts both v3 and v4 |
| `@ai-sdk/react@3.0.139` | `react@^18 \|\| ~19.x` | Works with React 18 and 19; requires `ai@6.x` companion |
| `@ai-sdk/openai@3.0.48` | `ai@6.x` | Provider version tracks `ai` major version scheme (ai v6 → @ai-sdk/* v3) |
| `drizzle-orm@0.45.1` | `postgres@3.x`, `pg@8.x`, `node@18+` | Stable latest; v1.0.0-beta is NOT stable |
| `drizzle-kit@0.31.10` | `drizzle-orm@0.45.x` | Kit and ORM must be kept in sync; kit 0.31.x matches orm 0.45.x |
| `next@16.2.1` | `react@19`, `node@18.18+` | React 19 is the default for Next.js 16; React 18 still works |

---

## Sources

- `npm view ai dist-tags` — verified `ai@6.0.137` is current `latest` tag; confirmed `ai-v5` and `ai-v6` dist-tags exist
- `npm view @ai-sdk/openai version` — `3.0.48`
- `npm view @ai-sdk/react version` — `3.0.139`
- `npm view drizzle-orm version` — `0.45.1` (stable); beta track is `1.0.0-beta.19`
- `npm view drizzle-kit version` — `0.31.10`
- `npm view next version` — `16.2.1`
- `npm view zod version` — `4.3.6`
- `npm view postgres version` — `3.4.8`
- https://ai-sdk.dev/docs/getting-started/nextjs-app-router — canonical quickstart, verified useChat + streamText + toDataStreamResponse pattern
- https://ai-sdk.dev/docs/migration-guides/migration-guide-4-0 — breaking changes v3→v4 (StreamingTextResponse removed, convertToCoreMessages deprecated, baseUrl→baseURL)
- https://v4.ai-sdk.dev/docs/migration-guides/migration-guide-5-0 — v4→v5 migration notes
- https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text — streamText API reference, onFinish callback, toDataStreamResponse
- https://orm.drizzle.team/docs/latest-releases — Drizzle release history, v1.0.0-beta.2 announcement (not stable)
- https://stackoverflow.com/questions/78693491/ — query API vs SQL-like API community consensus

---

*Stack research for: Streaming Chatbot (Next.js App Router + Vercel AI SDK + OpenAI + Drizzle ORM + Postgres)*
*Researched: 2025-07-14*
