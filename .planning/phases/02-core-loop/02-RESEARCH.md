# Phase 2: Core Loop — Research

**Phase:** 02-core-loop
**Researched:** 2026-03-24
**Requirements covered:** MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, PERS-01, PERS-02, PERS-03, PERS-04, RELY-01, RELY-02, RELY-03
**Confidence:** HIGH — all patterns verified against installed `node_modules` (`ai@6.0.137`, `@ai-sdk/react@3.0.139`)

---

## 1. Critical API Correction: `toUIMessageStreamResponse()` — Not `toDataStreamResponse()`

**This is the highest-priority finding.** The existing route stub already uses the correct method. Do not regress it.

The Phase 1 research documents (STACK.md, ARCHITECTURE.md) were written against older SDK conventions and consistently reference `toDataStreamResponse()`. **That method does NOT exist in `ai@6.0.137`.** Inspecting `node_modules/ai/dist/index.d.ts` confirms:

```ts
// What EXISTS in ai@6.0.137:
toUIMessageStreamResponse(options?: UIMessageStreamResponseInit): Response;
toTextStreamResponse(init?: ResponseInit): Response;

// What does NOT exist in ai@6.0.137:
// toDataStreamResponse() — ABSENT from the type declarations
```

The route stub (`src/app/api/chat/route.ts`) already uses `result.toUIMessageStreamResponse()` — this is correct. Any plan or implementation that follows old research documents and uses `toDataStreamResponse()` will fail at runtime.

**Correct route handler skeleton (verified against installed package):**

```ts
// src/app/api/chat/route.ts
import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { id: chatId, messages } = await req.json();
  // messages = UIMessage[] from useChat (ai@6 sends { id, messages, trigger, messageId, ...body })

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: modelMessages,
    system: 'You are a helpful assistant.',
  });

  return result.toUIMessageStreamResponse();
}
```

---

## 2. `useChat` Hook in AI SDK v6 — API Changes From Prior Research

**The `@ai-sdk/react@3.0.139` `useChat` hook has a substantially different API from what ARCHITECTURE.md describes.** Prior research was written for an older SDK version. The actual installed API is:

### 2.1 What the Hook Returns

```ts
// From node_modules/@ai-sdk/react/dist/index.d.ts (verified)
type UseChatHelpers<UI_MESSAGE extends UIMessage> = {
  readonly id: string;
  setMessages: (messages: UI_MESSAGE[] | ((m: UI_MESSAGE[]) => UI_MESSAGE[])) => void;
  error: Error | undefined;
} & Pick<AbstractChat<UI_MESSAGE>,
  'sendMessage' | 'regenerate' | 'stop' | 'resumeStream' |
  'addToolResult' | 'addToolOutput' | 'addToolApprovalResponse' |
  'status' | 'messages' | 'clearError'
>;
```

**Key differences from older API:**
- `isLoading` **does not exist** — replaced by `status: ChatStatus`
- `handleSubmit` / `handleInputChange` **do not exist** — replaced by `sendMessage()`
- `input` state management **is not part of the hook** — components must manage it with `useState`
- `ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error'`
- Derived boolean: `const isLoading = status === 'submitted' || status === 'streaming'`

### 2.2 Hook Options

```ts
type UseChatOptions<UI_MESSAGE> = ({
  chat: Chat<UI_MESSAGE>;    // pass a pre-created Chat instance, OR...
} | ChatInit<UI_MESSAGE>)   // ...pass ChatInit options directly
& {
  experimental_throttle?: number;
  resume?: boolean;
};

// ChatInit (the most common pattern for this project):
interface ChatInit<UI_MESSAGE> {
  id?: string;                    // tie hook to a specific chat ID
  messages?: UI_MESSAGE[];        // initial messages (replaces initialMessages)
  transport?: ChatTransport;      // defaults to DefaultChatTransport (HTTP to /api/chat)
  onError?: ChatOnErrorCallback;
  onFinish?: ChatOnFinishCallback;
  onData?: ChatOnDataCallback;
  // ...
}
```

**`initialMessages` does not exist as a prop name** — the field is `messages` in `ChatInit`.

### 2.3 Sending `chatId` to the Route Handler

The `body` option lives on the `transport` configuration, not directly on the hook. There are two patterns:

**Pattern A — `DefaultChatTransport` with `body` (recommended for this project):**

```ts
// components/ChatInterface.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export function ChatInterface({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: UIMessage[];
}) {
  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,         // seed from DB (replaces old initialMessages prop)
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { chatId },               // merged into every POST body
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  // ...
}
```

**What the route handler receives in `req.json()`:**

The SDK always sends this body structure (confirmed by reading `node_modules/ai/dist/index.js` line ~12835):

```json
{
  "id": "<chatId passed as useChat id option>",
  "messages": [...],
  "trigger": "submit-message",
  "messageId": "...",
  ...body  // any extra fields from transport body option
}
```

So the route handler can extract `chatId` from either `id` (auto-sent by SDK) or from the extra `body.chatId`. Using `id` is simpler:

```ts
// Route handler extraction
const { id: chatId, messages, trigger, messageId } = await req.json();
```

**Pattern B — Lean on SDK-sent `id` (simplest, no explicit transport needed):**

```ts
const { messages, sendMessage, status, error } = useChat({
  id: chatId,               // SDK sends this as `id` in every request body
  messages: initialMessages,
});
```

Route handler: `const { id: chatId, messages } = await req.json();`

This is simpler and requires no explicit `DefaultChatTransport`. Use Pattern B unless additional transport-level config is needed.

### 2.4 Submitting Messages

Old API: `<form onSubmit={handleSubmit}><input onChange={handleInputChange} /></form>`

New API: `sendMessage({ text: inputValue })` — manages its own input state separately:

```tsx
// components/MessageInput.tsx
'use client';
import { useState } from 'react';
import type { ChatStatus } from 'ai';

export function MessageInput({
  onSend,
  status,
}: {
  onSend: (text: string) => void;
  status: ChatStatus;
}) {
  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLoading}
        className="flex-1 resize-none rounded border p-2 disabled:opacity-50"
        rows={1}
      />
      <button type="submit" disabled={isLoading} className="...">
        Send
      </button>
    </form>
  );
}
```

```tsx
// In ChatInterface:
<MessageInput
  onSend={(text) => sendMessage({ text })}
  status={status}
/>
```

### 2.5 `error` State

`error: Error | undefined` from `useChat` is set when the HTTP request fails or the server returns a non-2xx response. Display in the thread:

```tsx
{error && (
  <div className="mx-4 rounded-lg bg-red-50 p-3 text-red-700 text-sm">
    {error.message || 'Something went wrong. Please try again.'}
  </div>
)}
```

---

## 3. Route Handler: Complete Pattern with Persistence and Retry

### 3.1 Full Route Handler Pattern

Covers MSG-01, MSG-02, MSG-03, PERS-01, PERS-02, PERS-03, RELY-01, RELY-02, RELY-03.

```ts
// src/app/api/chat/route.ts
import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '@/lib/db';
import { messages as messagesTable } from '@/lib/db/schema';
import { createMessage, getChat } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { id: chatId, messages } = await req.json();

  // Validate chatId
  if (!chatId || typeof chatId !== 'string') {
    return new Response('Missing chatId', { status: 400 });
  }

  // ── PHASE 1: Persist user message BEFORE calling LLM ──────────────────────
  // (PERS-02, RELY-02 — user message saved exactly once, outside retry loop)
  const lastMessage = messages.at(-1);
  if (lastMessage?.role === 'user') {
    await createMessage({
      id: crypto.randomUUID(),
      chatId,
      role: 'user',
      content: lastMessage.parts
        ?.filter((p: { type: string }) => p.type === 'text')
        .map((p: { text: string }) => p.text)
        .join('') ?? '',
    });
  }

  // ── PHASE 2: Convert UIMessages to ModelMessages ────────────────────────────
  const modelMessages = await convertToModelMessages(messages);

  // ── PHASE 3: Call LLM with built-in retry ──────────────────────────────────
  // SDK default: maxRetries = 2, exponential backoff, only retries APICallError
  // where isRetryable === true (5xx, timeout, network errors). RELY-01.
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: modelMessages,
    system: 'You are a helpful assistant.',
    // maxRetries: 2  — this is the SDK default; explicit for clarity
    onFinish: async ({ text }) => {
      // ── PHASE 4: Persist assistant response after stream completes ──────────
      // (PERS-03 — save AFTER streaming, not before)
      try {
        await createMessage({
          id: crypto.randomUUID(),
          chatId,
          role: 'assistant',
          content: text,
        });
      } catch (err) {
        // Silent DB failures are unacceptable — log explicitly. (See Failure Mode 3)
        console.error('[chat] CRITICAL: Failed to persist assistant message:', err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### 3.2 Built-in SDK Retry vs Manual Retry

**RELY-01 is satisfied by the built-in `maxRetries` option** — the SDK has production-quality exponential backoff with retry headers support:

From `node_modules/ai/dist/index.js` line 2745:
```js
const maxRetriesResult = maxRetries != null ? maxRetries : 2; // default: 2 retries
// Only retries when: error instanceof APICallError && error.isRetryable === true
// isRetryable is true for: 429 (rate limit), 500, 502, 503, 504, and network timeouts
```

**The built-in retry is applied to the LLM call only, not the DB write** — this is exactly the correct behavior for RELY-02 (no message duplication). Because the user message save happens before `streamText()` is called, and because `streamText` with `maxRetries: 2` will internally retry 5xx/timeout failures but never call `onFinish` multiple times for one logical call, there is no duplication risk from the LLM retry mechanism.

**Explicit custom retry is not needed for RELY-01.** However, if a manual wrapper is required:

```ts
// Hand-rolled retry — only if SDK built-in is insufficient
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isTransient =
        err instanceof Error && (
          err.message.includes('timeout') ||
          err.message.includes('network') ||
          /5\d\d/.test(err.message)
        );
      if (!isTransient || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
```

**RELY-02 enforcement:** User message save is OUTSIDE the retry loop. The pattern is:

```
1. await createMessage({ role: 'user', ... })    // once, before any retries
2. streamText({ maxRetries: 2, ... })             // LLM retried internally by SDK
3. onFinish: createMessage({ role: 'assistant' }) // once, after stream completes
```

---

## 4. Drizzle ORM CRUD Query Patterns for `lib/db/queries.ts`

All functions use the existing `db` client from `@/lib/db` and inferred types from `@/lib/db/schema`.

### 4.1 Import Pattern

```ts
// src/lib/db/queries.ts
import { db } from '@/lib/db';
import {
  chats,
  messages,
  type Chat,
  type Message,
  type NewMessage,
} from '@/lib/db/schema';
import { eq, asc, desc } from 'drizzle-orm';
```

### 4.2 All Required Functions

```ts
// ─── Chat CRUD ────────────────────────────────────────────────────────────────

export async function createChat(id?: string): Promise<Chat> {
  const chatId = id ?? crypto.randomUUID();
  const [chat] = await db
    .insert(chats)
    .values({ id: chatId, title: 'New Chat' })
    .returning();
  return chat;
}

export async function getChats(): Promise<Chat[]> {
  return db
    .select()
    .from(chats)
    .orderBy(desc(chats.updatedAt));
}

export async function getChat(chatId: string): Promise<Chat | undefined> {
  const [chat] = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId));
  return chat;
}

export async function updateChat(
  chatId: string,
  data: Partial<Pick<Chat, 'title' | 'updatedAt'>>,
): Promise<void> {
  await db
    .update(chats)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chats.id, chatId));
}

export async function deleteChat(chatId: string): Promise<void> {
  // CASCADE on FK means messages are deleted automatically
  await db.delete(chats).where(eq(chats.id, chatId));
}

// ─── Message CRUD ─────────────────────────────────────────────────────────────

export async function getMessages(chatId: string): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt));
}

export async function createMessage(
  data: Omit<NewMessage, 'createdAt'>,
): Promise<Message> {
  const [message] = await db
    .insert(messages)
    .values(data)
    .returning();
  return message;
}
```

### 4.3 Type Notes

- `Chat` = `typeof chats.$inferSelect` — use for return types and props
- `Message` = `typeof messages.$inferSelect` — use for return types
- `NewMessage` = `typeof messages.$inferInsert` — use for insert params
- The `role` column is `text` with an enum check constraint, typed as `'user' | 'assistant' | 'system'`

### 4.4 Index Verification

The migration confirms `CREATE INDEX "messages_chat_id_idx" ON "messages" USING btree ("chat_id")` — `getMessages(chatId)` will use this index. No additional index work needed.

---

## 5. Server Component + `initialMessages` Flow

Covers PERS-04.

### 5.1 `app/chat/[chatId]/page.tsx` (Server Component)

```tsx
// src/app/chat/[chatId]/page.tsx
import { notFound } from 'next/navigation';
import { getChat, getMessages } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;       // Next.js 16: params is async

  const chat = await getChat(chatId);
  if (!chat) notFound();

  const dbMessages = await getMessages(chatId);

  // Convert DB Message[] to UIMessage[] for useChat initialMessages
  const initialMessages = dbMessages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: m.content }],
    metadata: {},
  }));

  return (
    <ChatInterface
      chatId={chatId}
      initialMessages={initialMessages}
    />
  );
}
```

### 5.2 Why `params` Is `Promise<...>` in Next.js 16

Next.js 16 changed `params` to be a `Promise` (async). Always `await params` before accessing properties. Not doing this causes TypeScript errors and runtime failures.

### 5.3 DB `Message` → `UIMessage` Conversion

The `messages` table stores `content: text`. The `UIMessage` type in `ai@6` uses `parts: UIMessagePart[]`. The conversion is:

```ts
parts: [{ type: 'text', text: m.content }]
```

For simple text messages this is the complete conversion. The `metadata` field is required by the type and can be `{}`.

### 5.4 `useChat` With Pre-loaded Messages

```ts
const { messages, sendMessage, status, error } = useChat({
  id: chatId,
  messages: initialMessages,   // seeds the hook with DB history
});
```

- `useChat` uses `initialMessages` as the starting state; subsequent `sendMessage` calls append to this array
- The hook's internal state holds the optimistic view; DB is the source of truth on next page load
- Multi-turn context (MSG-03): the full `messages` array is sent to the route handler on every `sendMessage` call — the SDK sends the complete history automatically

---

## 6. Component Architecture

Covers MSG-01, MSG-02, MSG-04, MSG-05.

### 6.1 `ChatInterface.tsx`

```tsx
// src/components/ChatInterface.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatInterface({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: UIMessage[];
}) {
  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} isLoading={isLoading} error={error} />
      <MessageInput
        onSend={(text) => sendMessage({ text })}
        status={status}
      />
    </div>
  );
}
```

### 6.2 `MessageList.tsx`

```tsx
// src/components/MessageList.tsx
'use client';
import type { UIMessage } from 'ai';

function getTextContent(message: UIMessage): string {
  return message.parts
    ?.filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('') ?? '';
}

export function MessageList({
  messages,
  isLoading,
  error,
}: {
  messages: UIMessage[];
  isLoading: boolean;
  error?: Error;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === 'user'
                ? 'bg-gray-200 text-gray-900'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}
          >
            {getTextContent(message)}
          </div>
        </div>
      ))}

      {/* MSG-04: Loading indicator as a bubble in the thread (Decision D-03) */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      {/* MSG-05: Inline error bubble (Decision D-04) */}
      {error && !isLoading && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 6.3 `MessageInput.tsx`

Decision D-05: input disabled while loading.

```tsx
// src/components/MessageInput.tsx
'use client';
import { useState } from 'react';
import type { ChatStatus } from 'ai';

export function MessageInput({
  onSend,
  status,
}: {
  onSend: (text: string) => void;
  status: ChatStatus;
}) {
  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
          }
        }}
        disabled={isLoading}
        placeholder="Type a message..."
        className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={1}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
      >
        Send
      </button>
    </form>
  );
}
```

---

## 7. Root Page: Minimal "Start Chat" (Decision D-06)

```tsx
// src/app/page.tsx  — Phase 2 stub (Phase 3 replaces with auto-create + redirect)
import { redirect } from 'next/navigation';
import { createChat } from '@/lib/db/queries';

export default function HomePage() {
  async function startChat() {
    'use server';
    const chat = await createChat();
    redirect(`/chat/${chat.id}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={startChat}>
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          Start Chat
        </button>
      </form>
    </main>
  );
}
```

**Note for Phase 3:** This file is a stub. Phase 3 replaces it with auto-create + redirect logic (no button — immediate redirect to a new chat).

---

## 8. The Five Persistence Failure Modes

These are the five failure modes called out in the Phase 2 ROADMAP rationale. Each has a specific mitigation that must appear in the implementation.

### Failure Mode 1: Save-Before-Stream Causing Hang

**What happens:** `await result.text` or `await result.textStream` is called before `result.toUIMessageStreamResponse()` returns. The SDK's promises never resolve unless the stream is consumed — awaiting `result.text` before piping the stream causes an infinite hang (confirmed: GitHub issue #5438 pattern).

**Prevention:** Never await `result.text` in the route handler before returning. Only use `onFinish` for post-stream operations. The route handler must return `result.toUIMessageStreamResponse()` as its first and only response call.

```ts
// WRONG — causes hang:
const result = streamText({ ... });
const text = await result.text; // HANGS — stream not being consumed yet
await saveMessage(text);
return result.toUIMessageStreamResponse();

// CORRECT — uses onFinish:
const result = streamText({
  ...
  onFinish: async ({ text }) => { await saveMessage(text); },
});
return result.toUIMessageStreamResponse(); // return first, text resolves internally
```

### Failure Mode 2: User Message Lost on LLM Failure

**What happens:** The user message is persisted inside `onFinish` (only when LLM succeeds) or after the LLM call completes. If the LLM call fails (all retries exhausted), the user message is never saved. On page reload, the last user message is missing from history.

**Prevention:** Persist the user message BEFORE calling `streamText`. This is the first operation in the route handler. User message save is not inside the retry loop, not inside `onFinish`.

```ts
// Guaranteed sequence:
// 1. await createMessage({ role: 'user' })  ← FIRST, before LLM
// 2. streamText({ onFinish: createMessage({ role: 'assistant' }) })
```

### Failure Mode 3: Silent `onFinish` DB Error

**What happens:** `onFinish` calls `createMessage(...)` for the assistant response. The DB is temporarily unavailable. The insert throws. Because the HTTP stream already returned `200 OK`, this error has nowhere to propagate — it silently disappears. No log, no indication. The user saw the response but it was never stored.

**Prevention:** Wrap the entire `onFinish` body in `try/catch`. Log errors explicitly. The stream has already been sent so there is no way to surface this error to the user at this point, but logging is the minimum viable response.

```ts
onFinish: async ({ text }) => {
  try {
    await createMessage({ id: crypto.randomUUID(), chatId, role: 'assistant', content: text });
  } catch (err) {
    console.error('[chat] CRITICAL: Failed to persist assistant message:', {
      chatId,
      textLength: text.length,
      error: err,
    });
    // For demo scope: accept data loss for this rare case.
    // Production: enqueue retry job or write to fallback store.
  }
},
```

### Failure Mode 4: Message Duplication Across Retries

**What happens:** User message is saved inside the retry loop. Each retry attempt saves another copy. A transient LLM failure that retries twice creates 3 user message rows.

**Prevention:** The user message save lives **outside** and **before** any retry logic. With the SDK's built-in `maxRetries`, the SDK handles LLM-level retries internally and `onFinish` fires exactly once per successful stream — the user message save is never in the retry path.

**Pattern verification:**

```
request arrives
  │
  ├── await createMessage(user message)   ← runs ONCE, no retry
  │
  └── streamText({ maxRetries: 2 })
        ├── attempt 1 → LLM error (retryable) → delay
        ├── attempt 2 → LLM error (retryable) → delay
        └── attempt 3 → success → stream → onFinish → createMessage(assistant)
```

The user message row count is always 1, regardless of retry count. The assistant message row count is always 0 (on failure) or 1 (on success).

### Failure Mode 5: Response Buffered Instead of Streamed

**What happens:** The route handler returns a complete response body rather than streaming tokens. The user sees the loading indicator for the full generation time, then all text appears at once. `Transfer-Encoding: chunked` is absent from DevTools.

**Prevention:** Three requirements must all be true:
1. `export const dynamic = 'force-dynamic'` prevents Next.js route caching (already in route stub)
2. Return `result.toUIMessageStreamResponse()` — this returns a `Response` backed by a `ReadableStream`, not a JSON response
3. Do NOT await any `result.*` properties before returning — doing so causes the stream to buffer

**Verification:** DevTools Network tab → click the `/api/chat` request → inspect `Transfer-Encoding: chunked` header and observe incremental data frames in the Response tab.

---

## 9. `useChat` → Route Handler Body Format (AI SDK v6 Detail)

This is critical for correctly extracting `chatId` and `messages` in the route handler.

The `DefaultChatTransport` sends the following JSON body (from `node_modules/ai/dist/index.js` line ~12835):

```json
{
  "id":        "<value from useChat id option>",
  "messages":  [...UIMessage[]],
  "trigger":   "submit-message",
  "messageId": "...",
  // + anything in the transport's `body` option, merged in
}
```

Route handler extraction:

```ts
const {
  id: chatId,       // the chatId you passed as useChat id option
  messages,         // UIMessage[] — the full conversation history
  trigger,          // 'submit-message' or 'regenerate-message'
  messageId,        // ID of the triggering message
  // ...any extra body fields from transport.body
} = await req.json();
```

**The last message in `messages` is the new user message** (for `trigger === 'submit-message'`). Extract it with `messages.at(-1)`.

---

## 10. `convertToModelMessages` — Required for `streamText`

`streamText` accepts `messages: ModelMessage[]`, but `useChat` sends `UIMessage[]`. These types are NOT the same in AI SDK v6.

```ts
// From node_modules/ai/dist/index.d.ts
declare function convertToModelMessages<UI_MESSAGE extends UIMessage>(
  messages: Array<Omit<UI_MESSAGE, 'id'>>,
  options?: { tools?: ToolSet; ... }
): Promise<ModelMessage[]>;
```

This is an `async` function. Always `await` it:

```ts
const modelMessages = await convertToModelMessages(messages);
const result = streamText({ model: openai('gpt-4o-mini'), messages: modelMessages });
```

**Warning:** Passing `UIMessage[]` directly to `streamText`'s `messages` parameter will cause TypeScript errors and runtime failures because the shape differs (`parts` array vs `content` string).

---

## 11. Import Reference (Verified Against Installed Packages)

All imports verified against `node_modules/`:

| Symbol | Package | Note |
|--------|---------|------|
| `streamText` | `'ai'` | Server-side only |
| `convertToModelMessages` | `'ai'` | New in v6, async |
| `openai` | `'@ai-sdk/openai'` | Provider factory |
| `useChat` | `'@ai-sdk/react'` | Client-side only |
| `DefaultChatTransport` | `'ai'` | For explicit transport config |
| `type UIMessage` | `'ai'` | Client-side message type |
| `type ChatStatus` | `'ai'` | `'submitted' | 'streaming' | 'ready' | 'error'` |
| `type Chat` | `'@/lib/db/schema'` | Drizzle inferred type |
| `type Message` | `'@/lib/db/schema'` | Drizzle inferred type |
| `type NewMessage` | `'@/lib/db/schema'` | Drizzle inferred type |
| `eq`, `asc`, `desc` | `'drizzle-orm'` | Query helpers |
| `db` | `'@/lib/db'` | Drizzle client singleton |

**Do NOT use:**
- `'ai/react'` — this path does not exist in `ai@6.x` (`ai@6` has no `/react` export); use `'@ai-sdk/react'`
- `result.toDataStreamResponse()` — does not exist in `ai@6.0.137`
- `convertToCoreMessages()` — does not exist in `ai@6` (was removed in v5/v6)
- `initialMessages` as a prop to `useChat` — the option is `messages` in `ChatInit`
- `isLoading` from `useChat` — use `status === 'submitted' || status === 'streaming'`
- `handleSubmit` / `handleInputChange` from `useChat` — use `sendMessage({ text })`
- `append` from `useChat` — use `sendMessage({ text })` instead

---

## 12. Requirement Coverage Summary

| ID | Requirement | Covered In Section |
|----|-------------|-------------------|
| MSG-01 | User can type and send a message | §6.3 (MessageInput), §3.1 (route handler) |
| MSG-02 | Assistant response streams token-by-token | §1 (toUIMessageStreamResponse), §8 Failure Mode 5 |
| MSG-03 | Multi-turn conversation — full history sent | §2.3 (useChat sends full messages array), §3.1 |
| MSG-04 | Loading indicator while responding | §2.1 (status), §6.2 (pulsing dots) |
| MSG-05 | Error message on LLM failure | §2.5 (error state), §6.1, §6.2 |
| PERS-01 | Chat records stored in Postgres | §7 (root page createChat), §4.2 (createChat) |
| PERS-02 | User message persisted BEFORE LLM call | §3.1, §8 Failure Mode 2 |
| PERS-03 | Assistant response persisted via `onFinish` | §3.1, §8 Failure Mode 1 & 3 |
| PERS-04 | Fetching messages from DB into chat view | §5 (Server Component + initialMessages) |
| RELY-01 | Retry on transient failure, min 2 retries | §3.2 (SDK built-in maxRetries=2) |
| RELY-02 | No message duplication across retries | §3.2, §8 Failure Mode 4 |
| RELY-03 | Exhausted retries surfaced to user | §2.5 (error state), SDK throws RetryError → caught by useChat |

---

## 13. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Using `toDataStreamResponse()` from old docs | HIGH | Crash | Section §1 is the primary finding; route stub already correct |
| Using `isLoading` / `handleSubmit` from old docs | HIGH | TypeScript error | §2.1, §2.4 document the new API |
| `messages` param type mismatch (UIMessage vs ModelMessage) | HIGH | TypeScript error + runtime fail | §10: always `await convertToModelMessages()` |
| `onFinish` DB write silent failure | MEDIUM | Data loss | §8 Failure Mode 3: mandatory try/catch with logging |
| `params` not awaited in Next.js 16 | MEDIUM | TypeScript/runtime error | §5.2: `const { chatId } = await params` |
| User message duplication on retry | LOW | DB corruption | Prevented by SDK architecture (§3.2, §8 Failure Mode 4) |
| Response buffered instead of streaming | LOW | UX failure | `export const dynamic = 'force-dynamic'` + correct return type (§8 Failure Mode 5) |
| DB connection exhaustion | LOW | Dev mode failures | globalThis singleton already in `lib/db/index.ts` (Phase 1) |

---

## 14. File Creation Checklist for Phase 2

| File | Action | Key Detail |
|------|--------|------------|
| `src/app/api/chat/route.ts` | Modify | Add chatId extraction, user msg persist, onFinish, convertToModelMessages |
| `src/lib/db/queries.ts` | Create | All 7 CRUD functions (§4.2) |
| `src/components/ChatInterface.tsx` | Create | `'use client'`, useChat with id + messages |
| `src/components/MessageList.tsx` | Create | `'use client'`, renders UIMessage[], loading dots, error bubble |
| `src/components/MessageInput.tsx` | Create | `'use client'`, local useState for input, sendMessage({ text }) |
| `src/app/chat/[chatId]/page.tsx` | Create | Server Component, await params, getMessages, convert to UIMessage[] |
| `src/app/page.tsx` | Modify | Replace smoke test with Server Action + Start Chat button |

---

## RESEARCH COMPLETE
