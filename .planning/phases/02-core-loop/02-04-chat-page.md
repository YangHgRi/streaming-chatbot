---
id: 02-04-chat-page
phase: 2
wave: 3
depends_on: [02-02-route-handler, 02-03-chat-components]
files_modified:
  - src/app/chat/[chatId]/page.tsx
  - src/app/page.tsx
autonomous: true
requirements: [PERS-04, MSG-01]
---

# Plan 04: Chat Page and Root Page Stub

## Objective

1. Create `src/app/chat/[chatId]/page.tsx` — Next.js Server Component that fetches messages from Postgres and renders `ChatInterface` with `initialMessages` and `chatId` (PERS-04).
2. Replace `src/app/page.tsx` with a functional root page: a "Start New Chat" button that calls a Server Action to create a chat in Postgres and redirect to `/chat/[chatId]` (MSG-01).

Design decision from CONTEXT.md D-06: Chat page is a Server Component. D-07: Root page has a prominent "Start Chat" button using a Server Action.

<tasks>

<task id="T01" title="Create src/app/chat/[chatId]/page.tsx">
  <read_first>
  - `src/app/chat/[chatId]/page.tsx` — if file exists from Phase 1, read current state
  - `src/components/ChatInterface.tsx` — props interface: `{ chatId: string; initialMessages: UIMessage[] }`
  - `src/lib/db/queries.ts` — `getMessages(chatId)` signature and return type `Message[]`
  - `.planning/phases/02-core-loop/02-RESEARCH.md` — §5 Server Component + initialMessages flow, Next.js 15/16 async params
  </read_first>

  <action>
  Create (or replace) `src/app/chat/[chatId]/page.tsx`:

  ```tsx
  import type { UIMessage } from 'ai';
  import { getMessages } from '@/lib/db/queries';
  import { ChatInterface } from '@/components/ChatInterface';
  import { notFound } from 'next/navigation';

  export default async function ChatPage({
    params,
  }: {
    params: Promise<{ chatId: string }>;
  }) {
    // IMPORTANT: params is a Promise in Next.js 15+. Must await before accessing.
    const { chatId } = await params;

    // Fetch message history from Postgres (PERS-04)
    const dbMessages = await getMessages(chatId);

    // If no messages and chatId is invalid, surface 404
    // (A valid chat always has at least one user message from MSG-01 flow)
    // Commented out by default — only enable if getChat check is desired:
    // const chat = await getChat(chatId);
    // if (!chat) notFound();

    // Convert DB Message[] to UIMessage[] shape expected by useChat's `messages` option.
    // AI SDK v6: UIMessage requires id, role, parts array, and metadata. No top-level `content` field.
    const initialMessages: UIMessage[] = dbMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      metadata: {},
    }));

    return (
      <main className="flex flex-col h-screen bg-gray-50">
        <header className="border-b bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
        </header>
        <div className="flex-1 overflow-hidden">
          <ChatInterface chatId={chatId} initialMessages={initialMessages} />
        </div>
      </main>
    );
  }
  ```

  Notes:
  - No `'use client'` — this is a Server Component (D-06)
  - `params: Promise<{ chatId: string }>` — Next.js 15 async params pattern
  - `await params` BEFORE accessing `chatId` (not `params.chatId` directly)
  - DB `Message.content` is stored as plain text; UIMessage needs it in `parts` array
  - `initialMessages` converts content to `parts: [{ type: 'text', text: content }]`
  - `h-screen` layout ensures the chat fills the full viewport
  </action>

  <acceptance_criteria>
  - `src/app/chat/[chatId]/page.tsx` exists
  - `src/app/chat/[chatId]/page.tsx` does NOT contain `'use client'`
  - `src/app/chat/[chatId]/page.tsx` contains `import { getMessages } from '@/lib/db/queries'`
  - `src/app/chat/[chatId]/page.tsx` contains `import { ChatInterface } from '@/components/ChatInterface'`
  - `src/app/chat/[chatId]/page.tsx` contains `params: Promise<{ chatId: string }>`
  - `src/app/chat/[chatId]/page.tsx` contains `const { chatId } = await params`
  - `src/app/chat/[chatId]/page.tsx` contains `await getMessages(chatId)`
  - `src/app/chat/[chatId]/page.tsx` contains `initialMessages: UIMessage[]`
  - `src/app/chat/[chatId]/page.tsx` contains `parts: [{ type: 'text'`
  - `src/app/chat/[chatId]/page.tsx` contains `metadata: {}`
  - `src/app/chat/[chatId]/page.tsx` does NOT contain `content: msg.content`
  - `src/app/chat/[chatId]/page.tsx` contains `<ChatInterface chatId={chatId} initialMessages={initialMessages}`
  </acceptance_criteria>
</task>

<task id="T02" title="Replace src/app/page.tsx with Start Chat button using Server Action">
  <read_first>
  - `src/app/page.tsx` — current Phase 1 content (DB smoke test — must be replaced)
  - `src/lib/db/queries.ts` — `createChat()` signature: `async function createChat(id?: string): Promise<Chat>`
  - `.planning/phases/02-core-loop/02-CONTEXT.md` — D-07: root page has a "Start Chat" button; Server Action handles chat creation and redirect
  - `.planning/phases/02-core-loop/02-RESEARCH.md` — §7 root page stub pattern, Server Action with 'use server'
  </read_first>

  <action>
  Replace the entire content of `src/app/page.tsx`:

  ```tsx
  import { redirect } from 'next/navigation';
  import { createChat } from '@/lib/db/queries';

  async function startChat() {
    'use server';
    const chat = await createChat();
    redirect(`/chat/${chat.id}`);
  }

  export default function HomePage() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Streaming Chat</h1>
            <p className="text-gray-500">Start a conversation with the AI assistant</p>
          </div>
          <form action={startChat}>
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Start New Chat
            </button>
          </form>
        </div>
      </main>
    );
  }
  ```

  Notes:
  - `startChat` is a Server Action (`'use server'` directive inside async function)
  - `form action={startChat}` — no JavaScript required, works as HTML form
  - `createChat()` generates a UUID and inserts a row in `chats` table (PERS-01 trigger)
  - `redirect('/chat/${chat.id}')` navigates to the new chat's page
  - No `'use client'` — HomePage is a Server Component; Server Action handles the mutation
  - Removes the Phase 1 DB smoke test entirely
  </action>

  <acceptance_criteria>
  - `src/app/page.tsx` contains `import { createChat } from '@/lib/db/queries'`
  - `src/app/page.tsx` contains `import { redirect } from 'next/navigation'`
  - `src/app/page.tsx` contains `'use server'`
  - `src/app/page.tsx` contains `const chat = await createChat()`
  - `src/app/page.tsx` contains `redirect(\`/chat/${chat.id}\`)`
  - `src/app/page.tsx` contains `action={startChat}`
  - `src/app/page.tsx` contains `Start New Chat`
  - `src/app/page.tsx` does NOT contain `'use client'`
  - `src/app/page.tsx` does NOT contain `drizzle` (Phase 1 smoke test removed)
  - `src/app/page.tsx` does NOT contain `process.env.DATABASE_URL` (Phase 1 smoke test removed)
  </acceptance_criteria>
</task>

</tasks>

<verification>
TypeScript check:
```bash
npx tsc --noEmit
```
Expected: No errors in `src/app/chat/[chatId]/page.tsx` or `src/app/page.tsx`.

End-to-end smoke test (manual, dev server):
```bash
npm run dev
```
1. Navigate to `http://localhost:3000` — verify "Start New Chat" button is visible
2. Click "Start New Chat" — verify redirect to `/chat/[some-uuid]`
3. Type a message in the input and press Enter — verify message appears in thread
4. Verify pulsing dots appear while assistant is responding
5. Verify assistant response appears token-by-token (streaming)
6. Reload the page — verify full message history is restored from Postgres (PERS-04)

Database verification:
```bash
# After sending a message, check Postgres directly
psql $DATABASE_URL -c "SELECT role, content FROM messages ORDER BY created_at LIMIT 10;"
```
Expected: User message row appears before assistant message row; no duplicate user messages.
</verification>

<must_haves>
- `src/app/chat/[chatId]/page.tsx` has NO `'use client'` directive — must be a Server Component
- `await params` is called before accessing `chatId` (Next.js 15 async params)
- `initialMessages` converts DB `Message.content` to UIMessage `parts` array format
- `src/app/page.tsx` Server Action creates a chat via `createChat()` and redirects to `/chat/[id]`
- `src/app/page.tsx` removes all Phase 1 DB smoke test code
- Full page reload restores message history (PERS-04 satisfied)
- TypeScript compiles without errors across both files
</must_haves>
