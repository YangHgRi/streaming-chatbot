# Architecture Research

**Domain:** Streaming Chatbot — Next.js App Router + Vercel AI SDK + OpenAI + Drizzle ORM + Postgres
**Researched:** 2025-07-14
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │   Sidebar    │  │  ChatInterface │  │   MessageList       │  │
│  │  (chat list) │  │  (useChat hook)│  │ (streaming render)  │  │
│  └──────┬───────┘  └───────┬────────┘  └─────────────────────┘  │
│         │                  │ POST /api/chat  ↑ SSE token stream  │
├─────────┼──────────────────┼─────────────────────────────────────┤
│                        NEXT.JS SERVER                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Route Handler  app/api/chat/route.ts                     │  │
│  │  streamText() → toDataStreamResponse()                    │  │
│  │  onFinish callback → DB persist                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────┐  ┌──────────────────────────────────────┐ │
│  │  Server Pages     │  │  DB Query Layer (lib/db/)            │ │
│  │  app/page.tsx     │  │  getChats / getMessages /            │ │
│  │  app/chat/[id]/   │  │  createChat / saveMessages           │ │
│  └───────────────────┘  └──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                        EXTERNAL SERVICES                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌───────────────────────────────┐   │
│  │  OpenAI API           │  │  Postgres (via DATABASE_URL)  │   │
│  │  GPT-4o / GPT-4o-mini │  │  chats + messages tables      │   │
│  └───────────────────────┘  └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `app/page.tsx` | Entry point — redirect to existing chat or create new | Server Component; calls `createChat()`, then `redirect()` |
| `app/chat/[chatId]/page.tsx` | Chat view — loads messages and renders shell | Server Component; fetches chat + messages from DB, passes as `initialMessages` |
| `app/api/chat/route.ts` | Streaming API — accepts messages, calls OpenAI, streams back | Route Handler; `POST` only; uses `streamText` + `toDataStreamResponse` |
| `components/ChatInterface` | Manages chat state and input | Client Component (`"use client"`); owns `useChat` hook |
| `components/MessageList` | Renders message bubbles (incl. streaming partial) | Client Component; maps `messages` from `useChat`; shows streaming state |
| `components/Sidebar` | Lists all chats, highlights active | Client Component or Server Component with client link interactions |
| `lib/db/schema.ts` | Drizzle table definitions | `pgTable` declarations for `chats` and `messages` |
| `lib/db/queries.ts` | All DB interactions | Typed functions wrapping Drizzle queries |
| `lib/db/index.ts` | Drizzle client singleton | `drizzle(pool)` initialised once via `DATABASE_URL` |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Root: create/redirect to latest chat
│   ├── layout.tsx                # Root layout: sidebar + main slot
│   ├── chat/
│   │   └── [chatId]/
│   │       └── page.tsx          # Chat page (Server Component, loads messages)
│   └── api/
│       └── chat/
│           └── route.ts          # POST streaming handler
├── components/
│   ├── ChatInterface.tsx          # "use client" — owns useChat
│   ├── MessageList.tsx            # "use client" — renders messages
│   ├── MessageInput.tsx           # "use client" — input + submit
│   └── Sidebar.tsx                # Chat list navigation
├── lib/
│   ├── db/
│   │   ├── index.ts               # Drizzle client (pool + drizzle())
│   │   ├── schema.ts              # pgTable definitions
│   │   └── queries.ts             # getChats, createChat, getMessages, saveMessages
│   └── utils.ts                   # generateId, formatDate, etc.
├── drizzle/
│   └── migrations/                # Auto-generated SQL migrations
├── drizzle.config.ts              # Drizzle Kit config
└── .env.local                     # OPENAI_API_KEY, DATABASE_URL
```

### Structure Rationale

- **`app/api/chat/route.ts`:** Collocated with the App Router; Route Handlers here have first-class streaming support via Web Streams API — no workarounds needed
- **`lib/db/`:** Separating schema, client, and queries keeps the DB layer testable and reusable across Route Handlers and Server Components
- **`components/`:** All interactive components are isolated as Client Components so the rest of the app can stay server-rendered
- **`drizzle/migrations/`:** Keeps generated SQL out of `src/` and aligns with Drizzle Kit conventions

---

## Architectural Patterns

### Pattern 1: Route Handler with `streamText` + `toDataStreamResponse`

**What:** The POST handler calls `streamText`, pipes the result to the client as a data stream, and uses `onFinish` to persist after streaming completes.
**When to use:** Any streaming chatbot on App Router — this is the canonical Vercel AI SDK pattern.
**Trade-offs:** Simple and well-supported; `onFinish` runs server-side so no client round-trip for saves; the DB write is async and slightly after stream end.

**Example:**
```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { saveMessages } from '@/lib/db/queries';

export async function POST(req: Request) {
  const { messages, chatId } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages,
    onFinish: async ({ text, usage, finishReason }) => {
      // Fires after stream is fully consumed by client.
      // Safe to do async DB work here — stream has already been sent.
      await saveMessages({
        chatId,
        messages: [
          ...messages,                          // persist the user turn too
          { id: crypto.randomUUID(), role: 'assistant', content: text },
        ],
      });
    },
  });

  return result.toDataStreamResponse();
}
```

### Pattern 2: `useChat` with `initialMessages` for History Loading

**What:** The Server Component for the chat page fetches persisted messages from DB and passes them to `useChat` as `initialMessages`. The hook then manages live streaming on top of that baseline.
**When to use:** Every time you navigate to an existing chat — prevents an extra client-side fetch.
**Trade-offs:** Messages are loaded on server (fast, SEO-friendly); subsequent turns are handled client-side by `useChat` with optimistic state.

**Example:**
```typescript
// app/chat/[chatId]/page.tsx  (Server Component)
import { getMessages, getChat } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';

export default async function ChatPage({ params }: { params: { chatId: string } }) {
  const chat = await getChat(params.chatId);
  const messages = await getMessages(params.chatId);

  return <ChatInterface chatId={params.chatId} initialMessages={messages} />;
}

// components/ChatInterface.tsx  ("use client")
import { useChat } from 'ai/react';

export function ChatInterface({ chatId, initialMessages }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    id: chatId,
    initialMessages,          // seeds useChat with DB-loaded history
    body: { chatId },         // forwarded to POST /api/chat
  });
  // ...render MessageList + MessageInput
}
```

### Pattern 3: Upsert-on-finish DB Write Strategy

**What:** Rather than inserting only the assistant reply, `onFinish` upserts the entire conversation tail — both the user message that triggered the turn and the assistant reply. The user message is stored with an `ON CONFLICT DO NOTHING` guard to avoid duplicates on retries.
**When to use:** Any time you want atomic, replay-safe persistence.
**Trade-offs:** Slightly more DB work per turn; eliminates the category of bugs where user messages get lost if the stream errors mid-flight.

**Example:**
```typescript
// lib/db/queries.ts
export async function saveMessages({ chatId, messages }) {
  await db.transaction(async (tx) => {
    for (const msg of messages) {
      await tx
        .insert(messagesTable)
        .values({ ...msg, chatId })
        .onConflictDoNothing();       // idempotent — safe to retry
    }
    await tx
      .update(chatsTable)
      .set({ updatedAt: new Date() })
      .where(eq(chatsTable.id, chatId));
  });
}
```

---

## Data Flow

### Full Request Flow

```
[User types message + hits Send]
         │
         ▼
[useChat.handleSubmit()]
  • Appends user message to local state (optimistic — instant UI update)
  • Sends POST /api/chat  { messages: [...history, userMsg], chatId }
         │
         ▼
[Route Handler  app/api/chat/route.ts]
  • Validates chatId
  • Calls streamText({ model, messages })
  • Calls OpenAI API → receives streaming token chunks
  • Returns result.toDataStreamResponse()
         │
         ▼  (Server-Sent Events / ReadableStream over HTTP)
[useChat receives stream]
  • Appends assistant message placeholder to state
  • Updates content token-by-token → MessageList re-renders each chunk
  • isLoading = true during stream, false after
         │
         ▼
[Stream fully consumed by client]
         │  (concurrently — server side)
         ▼
[onFinish callback fires on server]
  • Receives: { text (full assistant reply), usage, finishReason }
  • Writes user message + assistant message to Postgres via Drizzle
  • Updates chat.updatedAt
         │
         ▼
[Next page load / navigation]
  • Server Component re-fetches from DB
  • initialMessages reflects persisted state
```

### State Management

```
[Postgres DB]  ─── Server Component load ──▶  initialMessages prop
                                                      │
                                               [useChat hook]
                                                      │
                      optimistic local state ◀────────┤────────▶ streaming tokens
                                                      │
                                               [MessageList]
                                                (renders both)
```

### Key Data Flows

1. **New chat creation:** `app/page.tsx` calls `createChat()` on the server, then `redirect('/chat/<newId>')` — no client JS needed for this step.
2. **Turn persistence:** `onFinish` on the server handles all DB writes; client never explicitly calls a save endpoint.
3. **Chat title update:** On first message, a background `updateChatTitle()` can derive a title from the first user message; done inside `onFinish` or as a fire-and-forget after the response.
4. **Sidebar refresh:** Sidebar is a Server Component wrapped in a layout; navigating to a new chat causes a layout re-render, which re-fetches the chat list.

---

## Schema Design

### Drizzle ORM — Postgres Tables

```typescript
// lib/db/schema.ts
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id:        text('id').primaryKey(),                          // nanoid() — e.g. "abc123xyz"
  title:     text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
  'messages',
  {
    id:        text('id').primaryKey(),                        // nanoid() per message
    chatId:    text('chat_id')
                 .notNull()
                 .references(() => chats.id, { onDelete: 'cascade' }),
    role:      text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content:   text('content').notNull(),                      // full text for this project scope
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    chatIdIdx: index('messages_chat_id_idx').on(table.chatId),
  }),
);

// Inferred types for use throughout the app
export type Chat    = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

### Schema Rationale

| Decision | Reason |
|----------|--------|
| `text` IDs (nanoid) | Client can generate IDs before server confirms — enables optimistic inserts |
| `role` as enum column | Prevents invalid role values at DB level; Drizzle infers the union type |
| `content` as `text` (not `jsonb`) | For text-only chat this project scope, simple text avoids serialisation bugs. Upgrade to `jsonb` if adding tool calls later |
| `cascade` delete on messages | Deleting a chat cleans up all its messages atomically |
| `messages_chat_id_idx` index | All message queries filter by `chatId` — index is critical for response time |
| `updatedAt` on chats | Allows sidebar to sort chats by last activity without aggregating messages |

### Generated SQL (reference)

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
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_chat_id_idx ON messages (chat_id);
```

---

## Edge Cases

### Edge Case 1: Race Condition — Stream Ends Before DB Write Completes

**Problem:** `onFinish` fires server-side after the stream is fully sent to the client. The client immediately shows the complete response. If the user hits refresh within the ~50–200 ms window before the `onFinish` DB write commits, the page re-renders with the old message list (the new messages aren't in DB yet).

**How it manifests:** Intermittent message loss on fast refresh; never happens during normal flow. Most users won't encounter it.

**Mitigations (choose one):**
1. **Acceptable for demo scope:** The race window is tiny and requires deliberate fast-refresh. Do nothing.
2. **Soft guard:** After `handleSubmit` completes (stream done), call `router.refresh()` with a 300 ms delay to give `onFinish` time to write:
   ```typescript
   const { handleSubmit, ...rest } = useChat({ ... });
   const guardedSubmit = async (e) => {
     await handleSubmit(e);
     setTimeout(() => router.refresh(), 300);
   };
   ```
3. **Strong guard (overkill for demo):** Add a `POST /api/chats/[chatId]/confirm` endpoint that the client polls after stream completion, resolving only when DB confirms the write. Not needed here.

### Edge Case 2: `useChat` Optimistic UI vs Server-Persisted Messages

**Problem:** `useChat` maintains its own in-memory message list. After a stream completes, the hook's state holds the messages — but these are _not_ the server-persisted records. If the component unmounts and remounts (route change and back), `initialMessages` is re-fetched from DB (via the Server Component) and the hook re-seeds, which is correct. However, if the page does _not_ re-render, the hook state and the DB state can drift if the same `chatId` is reused with a fresh `useChat` instance.

**Solution:**
- Pass a stable `id` to `useChat` that matches `chatId` — the SDK uses this to namespace the internal message store.
- On any navigation back to the same chat, the Server Component always re-loads from DB into `initialMessages`, resetting the hook cleanly.
- Never try to manually sync `useChat.messages` with DB — trust `initialMessages` on mount and `onFinish` on writes. Don't fight the SDK.

**Pattern to avoid:**
```typescript
// BAD: fetching messages client-side with useEffect and trying to merge with useChat state
useEffect(() => {
  fetch(`/api/messages?chatId=${chatId}`)
    .then(r => r.json())
    .then(setMessages); // will conflict with useChat's own state
}, []);
```

### Edge Case 3: App Router vs Pages Router Streaming Implications

| Dimension | App Router (this project) | Pages Router |
|-----------|--------------------------|--------------|
| Streaming handler | `route.ts` in `app/api/` — returns native `Response` with `ReadableStream` | `api/*.ts` — requires `res.write()` / `res.flush()` pattern or `edge` runtime |
| Runtime | Node.js (default) or Edge — both work with Vercel AI SDK | Node.js or Edge |
| `toDataStreamResponse()` | Works natively — returns a `Response` object | Does NOT work — returns `Response`, not `NextApiResponse`; must use `pipeDataStreamToResponse(result, res)` instead |
| Server Components | Available — can load DB data without APIs | Not available — all data fetching goes through `getServerSideProps` |
| Layout nesting | First-class — sidebar in `layout.tsx` stays mounted across chat navigations | Would require manual `_app.tsx` management |
| `useRouter.refresh()` | Triggers Server Component re-fetch without full reload | Not available — would require full navigation |

**Key takeaway:** The App Router is not just preferred — `result.toDataStreamResponse()` literally does not exist in a Pages Router context. The Vercel AI SDK's streaming integration is designed around App Router Route Handlers returning `Response` objects.

---

## Suggested Build Order

Build in this sequence to always have a runnable app at each step.

### Phase 1 — Foundation (Day 1)

Goal: Next.js app boots, env vars load, Drizzle connects to DB.

1. `npx create-next-app` with App Router + TypeScript
2. Install deps: `ai`, `@ai-sdk/openai`, `drizzle-orm`, `drizzle-kit`, `postgres` (or `pg`), `nanoid`
3. `.env.local`: `OPENAI_API_KEY`, `DATABASE_URL`
4. `lib/db/index.ts`: Drizzle client singleton
5. Smoke test: log a DB query in a Server Component

### Phase 2 — Database Layer (Day 1–2)

Goal: Schema exists in Postgres, CRUD functions work.

1. `lib/db/schema.ts`: `chats` + `messages` table definitions
2. `drizzle.config.ts`: point at schema, set migrations dir
3. Run `drizzle-kit generate` + `drizzle-kit migrate`
4. `lib/db/queries.ts`: implement `createChat`, `getChats`, `getChat`, `getMessages`, `saveMessages`, `updateChat`, `deleteChat`
5. Test each query manually (or write a quick script)

### Phase 3 — API Route (Day 2)

Goal: Streaming works end-to-end via curl or Postman.

1. `app/api/chat/route.ts`: POST handler with `streamText` + `toDataStreamResponse`
2. Add `onFinish` callback that logs `text` to console (DB persist comes after UI)
3. Verify streaming response with a simple fetch test
4. Add basic error handling (try/catch, return 400/500)

### Phase 4 — UI Layer (Day 3–4)

Goal: Chat UI renders and streams without DB wiring.

1. `app/layout.tsx`: root layout with sidebar slot + main slot
2. `components/Sidebar.tsx`: static for now (hardcoded or empty)
3. `components/ChatInterface.tsx`: `useChat` hook, hardcoded `chatId` for now
4. `components/MessageList.tsx`: render `messages` array, style user vs assistant
5. `components/MessageInput.tsx`: textarea + submit button, wired to `handleSubmit`
6. `app/chat/[chatId]/page.tsx`: Server Component shell, renders `<ChatInterface>`
7. Verify streaming renders token-by-token in browser

### Phase 5 — Integration (Day 4–5)

Goal: Full flow — create chat → stream → persist → reload → history shows.

1. Wire `onFinish` in route handler to call `saveMessages`
2. `app/page.tsx`: create new chat, redirect to `/chat/<id>`
3. `app/chat/[chatId]/page.tsx`: load `initialMessages` from DB, pass to `ChatInterface`
4. `ChatInterface`: accept `initialMessages` prop, pass to `useChat`
5. `Sidebar`: fetch `getChats()` in a Server Component, render list with active highlight
6. Add chat title: derive from first user message in `onFinish`, call `updateChat`
7. Test full round-trip: create → chat → refresh → history intact

### Phase 6 — Polish (Day 5–7)

Goal: Demo-ready.

1. Auto-scroll `MessageList` to bottom on new messages
2. Disable input while `isLoading`
3. Handle OpenAI errors gracefully (display error message in chat)
4. Add retry logic for transient OpenAI failures (exponential backoff or Vercel AI SDK's built-in `maxRetries`)
5. Delete chat button in sidebar
6. Basic loading skeletons for sidebar

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Demo / 1 user | Current architecture is fine as-is — single Postgres instance, no caching |
| 1–100 users | Add a connection pool size limit to Drizzle (`max: 10`); keep everything else the same |
| 100–1000 users | Move to Neon/Supabase serverless Postgres with connection pooling (pgBouncer); consider caching chat list in Redis |
| 1000+ users | Horizontal API scaling (Vercel auto-scales); add DB read replica for chat history loads; stream token count metering |

### Scaling Priorities

1. **First bottleneck:** Postgres connection exhaustion under concurrent streaming requests — each request holds a connection for the duration of `onFinish`. Fix with connection pooling (Neon's serverless driver or pgBouncer).
2. **Second bottleneck:** OpenAI rate limits — add per-user (or global) rate limiting at the Route Handler level before calling `streamText`.

---

## Anti-Patterns

### Anti-Pattern 1: Saving Messages in the Client via `onFinish` in `useChat`

**What people do:** Use `useChat`'s client-side `onFinish` option to POST the completed messages back to a separate `/api/save-messages` endpoint.

**Why it's wrong:** This creates two HTTP round-trips per turn (stream + save), and the save request can fail silently if the user closes the tab before it completes. It also doubles the complexity.

**Do this instead:** Use `streamText`'s server-side `onFinish` callback. The callback runs on the server after the stream is fully sent — no extra request, no tab-close risk, atomic with the stream lifecycle.

### Anti-Pattern 2: Storing `messages` as JSONB for Simple Text Chats

**What people do:** Store the entire `messages` array as a single `jsonb` column on the chats table (one row per chat, content is `[{role, content}, ...]`).

**Why it's wrong:** Appending a single message requires fetching the full array, deserialising, appending, and reserialising. No ability to query individual messages. Deletions are expensive. Array grows unbounded.

**Do this instead:** One row per message in a normalised `messages` table with a `chat_id` FK. Append is a single `INSERT`. Querying is indexed. Deleting is straightforward.

### Anti-Pattern 3: Using Pages Router for a New Streaming Chatbot

**What people do:** Start with Pages Router because it's more familiar, then try to adapt the Vercel AI SDK streaming patterns.

**Why it's wrong:** `result.toDataStreamResponse()` returns a Web API `Response` object — Pages Router API routes use a Node.js `res: NextApiResponse` object. They are incompatible. You would need `pipeDataStreamToResponse(result, res)` (a different API), lose Server Components for DB loading, and lose `useRouter.refresh()` for post-stream syncs.

**Do this instead:** Use App Router. The Vercel AI SDK is designed around it. Route Handlers return `Response` objects natively, streaming works without adaptation, and Server Components remove the need for client-side data-fetching hooks.

### Anti-Pattern 4: Generating IDs Client-Side Without Server Validation

**What people do:** Let `useChat` generate message IDs on the client and trust them directly in the DB without validation.

**Why it's wrong:** In a multi-user system (not this project, but worth knowing), client-generated IDs are a vector for ID collision or poisoning attacks. Even in single-user demos, an empty-string ID bug (a known AI SDK v5 issue with `streamText` `onFinish`) can cause DB inserts to silently fail.

**Do this instead:** Generate IDs server-side in `onFinish` using `crypto.randomUUID()` or `nanoid()` — never trust the client-provided IDs for the assistant message.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI API | `@ai-sdk/openai` provider via `openai('gpt-4o-mini')` inside `streamText` | Key via `OPENAI_API_KEY` env var; SDK handles auth header automatically |
| Postgres | `drizzle(pool)` with `postgres` (or `pg`) driver; `DATABASE_URL` env var | Use `postgres` (postgres.js) for edge-compatible pooling; `pg` for traditional Node |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Route Handler ↔ DB | Direct function call — `queries.ts` imported in `route.ts` | No HTTP overhead; DB connection reused within request |
| Server Component ↔ DB | Direct function call — `queries.ts` imported in `page.tsx` | Same Drizzle client; queries run at render time |
| Client Component ↔ Route Handler | `useChat` → `POST /api/chat` via fetch (managed by SDK) | No manual fetch needed; SDK handles headers, body, and SSE parsing |
| Sidebar ↔ Chat Page | Next.js layout nesting — Sidebar is in `layout.tsx`, re-fetches on route change | `router.refresh()` triggers layout re-render to pick up new chat titles |

---

## Sources

- [Vercel AI SDK — Chatbot Message Persistence](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-message-persistence)
- [Vercel AI SDK — Getting Started: Next.js App Router](https://sdk.vercel.ai/docs/getting-started/nextjs-app-router)
- [Vercel AI SDK — `streamText` reference](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text)
- [Vercel AI SDK — Save messages to database (cookbook)](https://sdk.vercel.ai/cookbook/next/save-messages-to-database)
- [GitHub Discussion #4845 — Guidance on persisting messages](https://github.com/vercel/ai/discussions/4845)
- [GitHub PR #404 — Fix DB race condition at stream end](https://github.com/vercel/ai-chatbot/pull/404)
- [Drizzle ORM — pgTable, relations, migrations](https://orm.drizzle.team/docs/schemas)
- [Next.js — Route Handlers (App Router)](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Reddit r/nextjs — How to store messages generated by AI (Vercel AI SDK + Prisma)](https://www.reddit.com/r/nextjs/comments/1hd96gh/how_to_store_messages_generated_by_ai_vercel_ai/)
- [GitHub Issue #8305 — streamText onFinish empty ID bug (AI SDK v5)](https://github.com/vercel/ai/issues/8305)

---
*Architecture research for: Streaming Chatbot (Next.js App Router + Vercel AI SDK + OpenAI + Drizzle + Postgres)*
*Researched: 2025-07-14*
