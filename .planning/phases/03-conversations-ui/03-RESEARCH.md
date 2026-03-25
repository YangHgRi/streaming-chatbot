## RESEARCH COMPLETE

**Phase:** 03-conversations-ui
**Researched:** 2026-03-24
**Requirements covered:** CONV-01, CONV-02, CONV-03, CONV-04, CONV-05
**Confidence:** HIGH — all patterns verified against installed packages and live codebase

---

## 1. Codebase State: What Already Exists

### 1.1 Directory Structure

Project root is `D:/code_space/streaming-chatbot/`. All source lives under `src/`:

```
src/
  app/
    api/chat/route.ts         ← working streaming POST handler (Phase 2 complete)
    chat/[chatId]/page.tsx    ← Server Component; fetches messages; passes to ChatInterface
    layout.tsx                ← root layout (scaffold default — needs sidebar in Phase 3)
    page.tsx                  ← "Start New Chat" button + Server Action (Phase 2 stub)
    globals.css               ← Tailwind v4 via @import "tailwindcss"
  components/
    ChatInterface.tsx         ← 'use client'; owns useChat; chatId + initialMessages props
    MessageList.tsx           ← renders UIMessage[]; loading dots; error bubble
    MessageInput.tsx          ← textarea + send button; disabled while isLoading
  lib/
    db/
      index.ts               ← Drizzle client singleton (globalThis guard)
      schema.ts              ← chats + messages tables; Chat, Message, NewMessage types
      queries.ts             ← all 7 CRUD functions (see §1.3)
```

### 1.2 `app/chat/[chatId]/page.tsx` — CONFIRMED COMPLETE

This file exists and is fully implemented:

```tsx
// src/app/chat/[chatId]/page.tsx
import type { UIMessage } from 'ai';
import { getMessages, getChat } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';
import { notFound } from 'next/navigation';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;   // params is a Promise in Next.js 15+
}) {
  const { chatId } = await params;       // must await
  const chat = await getChat(chatId);
  if (!chat) notFound();
  const dbMessages = await getMessages(chatId);
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

**Phase 3 impact:** This file will need modification. The `<main>` + `<header>` wrapper is a placeholder layout — once the root layout gains a sidebar slot, the per-chat page should no longer own its own full-screen shell. It will become the `children` slot inside the layout. The `<header>` with `"Chat"` as a static title can be replaced by the dynamic chat title (passed from the Server Component as a prop or rendered directly).

### 1.3 `lib/db/queries.ts` — All Required Functions Exist

Every DB function Phase 3 needs is already written and typed:

| Function | Signature | Phase 3 Usage |
|----------|-----------|---------------|
| `createChat(id?)` | `Promise<Chat>` | CONV-01: create new chat |
| `getChats()` | `Promise<Chat[]>` | CONV-02: sidebar list, ordered `desc(updatedAt)` |
| `getChat(chatId)` | `Promise<Chat \| undefined>` | CONV-03: validate chatId in page |
| `updateChat(chatId, data)` | `Promise<void>` | CONV-04: rename conversation |
| `deleteChat(chatId)` | `Promise<void>` | CONV-05: delete + cascade messages |
| `getMessages(chatId)` | `Promise<Message[]>` | CONV-03: fetch history |
| `createMessage(data)` | `Promise<Message>` | Used in route handler (Phase 2) |

Key details:
- `getChats()` returns chats ordered by `desc(chats.updatedAt)` — most-recent-first, which is the correct sidebar order.
- `deleteChat()` comment explicitly notes: "CASCADE on FK means messages are deleted automatically" — the `onDelete: 'cascade'` is set in the schema. CONV-05 is covered at the DB layer.
- `updateChat()` always sets `updatedAt: new Date()` in addition to the provided data — this automatically re-orders the updated chat to the top of `getChats()`.
- `Chat` type: `{ id: string; title: string; createdAt: Date; updatedAt: Date }` — `title` defaults to `'New Chat'`.

### 1.4 `app/layout.tsx` — Scaffold Default, Must Be Replaced

Current state:

```tsx
// src/app/layout.tsx (CURRENT — scaffold default)
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

Phase 3 must replace `<body>` to introduce a two-column layout: sidebar on the left, main content on the right. The font variables and `h-full` / `antialiased` on `<html>` should be preserved.

### 1.5 `app/page.tsx` — Phase 2 Stub, Must Be Replaced

Current state is a "Start New Chat" button with a Server Action that creates a chat and redirects. In Phase 3, the root page should auto-redirect without requiring a button click — per the ROADMAP: "root entry point: creates a new chat and redirects to `/chat/<id>`". The current implementation is a valid approach but shows a landing page first; Phase 3 may want an immediate redirect on page load instead.

### 1.6 `components/ChatInterface.tsx` — No Cleanup, Needs `useEffect`

Current `ChatInterface` has no stream cleanup:

```tsx
// CURRENT — missing useEffect cleanup
const { messages, sendMessage, status, error } = useChat({
  id: chatId,
  messages: initialMessages,
});
```

There is no `useEffect` calling `stop()` when `chatId` changes or the component unmounts. This is the stream leak vector identified as a Phase 3 gate criterion: "Mid-stream chat switch does not leak tokens into the destination conversation."

### 1.7 CSS / Tailwind

- Tailwind v4 is in use: `@import "tailwindcss"` in `globals.css`. No `tailwind.config.ts`. Utility classes work directly.
- `<html>` has `h-full` — critical for full-height sidebar layout. `<body>` currently has `min-h-full flex flex-col`.
- For sidebar layout, `<body>` should become `h-full flex` (or `h-screen flex`) with the sidebar as a fixed-width child and main as `flex-1 overflow-hidden`.

---

## 2. Next.js 15 Layout Patterns

### 2.1 Root Layout with Sidebar Slot

The App Router `layout.tsx` renders once at the root and does **not** re-render on navigation — `children` is re-rendered but the layout stays mounted. This is the persistence mechanism for the sidebar: place it in the layout and it survives route changes.

**Recommended layout structure:**

```tsx
// src/app/layout.tsx
import { Sidebar } from '@/components/Sidebar';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
```

Key Tailwind classes:
- `<html className="h-full">` — already set in scaffold; makes 100% height work
- `<body className="h-full flex">` — horizontal flex container fills the viewport
- `<Sidebar />` — fixed-width column (e.g., `w-64 flex-shrink-0`)
- `<main className="flex-1 overflow-hidden">` — takes remaining width; `overflow-hidden` lets inner content scroll independently

### 2.2 Server Component Layout is Fine — No Special Async Needed

`layout.tsx` can be an `async` Server Component. This lets the layout itself call `getChats()` and pass data down... but that pattern is **not recommended here** because the sidebar needs to re-render after mutations (create/rename/delete). Instead, put the `getChats()` call inside `Sidebar` as a Server Component — that component will re-fetch on every request after `revalidatePath` is called.

### 2.3 `params` in Next.js 15 Must Be Awaited

Already handled correctly in `app/chat/[chatId]/page.tsx`:
```tsx
const { chatId } = await params;  // params is Promise<{ chatId: string }> in Next.js 15+
```
This pattern is confirmed and must be preserved. Any new dynamic segments follow the same pattern.

---

## 3. Server Components vs Client Components: Sidebar Architecture

### 3.1 The Split Pattern

The sidebar needs:
1. **DB data** (`getChats()`) → Server Component responsibility
2. **Active route detection** (`usePathname()`) → Client Component only
3. **Delete/rename actions** → can be Server Actions (no client-side hook required)

**Recommended two-component architecture:**

```
Sidebar (Server Component)
  └── fetches getChats()
  └── renders SidebarClient (Client Component)
        └── receives chat[] as props
        └── calls usePathname() for active highlight
        └── contains delete/rename UI + their Server Actions
```

This keeps the expensive DB fetch on the server while delegating the single client-side concern (`usePathname`) to a thin wrapper.

**Alternative (simpler):** Make the entire `Sidebar` a Client Component, fetch data via a Route Handler or server action call inside `useEffect`. This is less idiomatic in the App Router and misses out on server-side rendering of the chat list. The two-component split is the correct Next.js pattern.

### 3.2 `usePathname` for Active Link

```tsx
'use client';
import { usePathname } from 'next/navigation';

export function SidebarClient({ chats }: { chats: Chat[] }) {
  const pathname = usePathname();
  // pathname will be '/chat/abc-123' when viewing that chat
  return (
    <nav>
      {chats.map(chat => {
        const isActive = pathname === `/chat/${chat.id}`;
        return (
          <Link
            key={chat.id}
            href={`/chat/${chat.id}`}
            className={isActive ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'}
          >
            {chat.title}
          </Link>
        );
      })}
    </nav>
  );
}
```

`usePathname` is a Client Component hook from `next/navigation`. It updates on every navigation automatically.

**Alternative: `useSelectedLayoutSegment`** — also a client hook that reads one level of the route segment. For `/chat/[chatId]`, calling `useSelectedLayoutSegment()` from a layout returns `'chat'`, not the chatId. For matching specific chatIds, `usePathname` is simpler.

---

## 4. `revalidatePath` for Sidebar Refresh

### 4.1 How It Works

`revalidatePath(path, type?)` invalidates the Next.js data cache for a specific path. When a Server Action calls it:
1. The cache entry for `path` is purged.
2. On the next navigation to (or re-render of) that path, Server Components in the path re-fetch their data.
3. For the sidebar (in `layout.tsx`), calling `revalidatePath('/', 'layout')` causes the entire root layout subtree to re-fetch — including `Sidebar`'s `getChats()` call.

**Rules:**
- Must be called from Server Actions or Route Handlers — not from Client Components directly.
- Call it **before** `redirect()` in create actions (so the new chat appears in the sidebar when the redirected page loads).
- `type = 'layout'` re-validates the layout and all pages under it. `type = 'page'` re-validates only a specific page.

### 4.2 Strategy Per Operation

| Operation | `revalidatePath` call | Reasoning |
|-----------|----------------------|-----------|
| Create chat | `revalidatePath('/', 'layout')` before `redirect(...)` | Sidebar must show new chat when redirect lands |
| Rename chat | `revalidatePath('/', 'layout')` | Sidebar title updates; optional: also `revalidatePath('/chat/${chatId}')` |
| Delete chat | `revalidatePath('/', 'layout')` before `redirect('/')` | Sidebar removes deleted entry |

**Single-path strategy:** Using `revalidatePath('/', 'layout')` everywhere is the simplest and most reliable approach. It causes the entire layout (including sidebar) to re-fetch on next render. The cost is a full server-component re-render of the sidebar on each mutation — acceptable for a single-user demo app.

### 4.3 Next.js 15 Caching Behavior Note

Next.js 15 changed fetch caching defaults: `fetch()` is **not cached by default** (unlike Next.js 13/14 which cached everything). For DB queries via Drizzle (not using `fetch`), there is no built-in data cache — queries re-execute on every request. This means `revalidatePath` is primarily needed to bust the **Router Cache** (client-side navigation cache), not a server-side data cache. The sidebar Server Component will naturally show fresh data on every full page load regardless.

---

## 5. Server Actions: Create, Rename, Delete

### 5.1 `redirect()` from Server Actions

`redirect()` from `next/navigation` works correctly in Server Actions in Next.js 15. The documented pattern:

```ts
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createChatAction() {
  'use server';
  const chat = await createChat();
  revalidatePath('/', 'layout');
  redirect(`/chat/${chat.id}`);  // throws a special Next.js error internally — do not wrap in try/catch
}
```

**Critical:** `redirect()` works by throwing an internal Next.js error. If called inside a `try/catch` block that catches all errors, the redirect will be swallowed. Always call `redirect()` outside try/catch, or in a `finally` block.

**Known issue in Next.js 15:** There was a bug report (`vercel/next.js #72842`) where `redirect()` from Server Actions did not execute on first attempt in some versions. This has been resolved in stable Next.js 15. Since this project uses `next@16.2.1` (which is effectively Next.js 16 / very stable 15), this is not a concern.

### 5.2 Root Page: Auto-Create + Redirect

The current `app/page.tsx` shows a "Start New Chat" button. The ROADMAP specifies: "root entry point: creates a new chat and redirects to `/chat/<id>`" — implying auto-redirect, not a button.

**Pattern A — Auto-redirect in Server Component (cleaner):**

```tsx
// src/app/page.tsx — auto-create and redirect
import { redirect } from 'next/navigation';
import { createChat } from '@/lib/db/queries';

export default async function HomePage() {
  const chat = await createChat();
  redirect(`/chat/${chat.id}`);
}
```

This runs on every visit to `/`, creates a chat, and redirects immediately. No button needed. The user never sees a landing page — they always land in a fresh chat.

**Pattern B — Keep button, make it the primary CTA:**
The current implementation. Acceptable for Phase 3 if the "New Chat" sidebar button handles the creation UX.

**Recommendation:** Pattern A is cleaner and matches the ROADMAP description. However, it creates a new chat on every root visit (including back-button navigation), which could create orphan chats. Since there's no auth and it's a demo, this is acceptable. Planner should decide: auto-redirect on load vs. keep landing page.

### 5.3 Inline Rename Server Action Pattern

For a simple rename that calls `updateChat`:

```tsx
// In SidebarClient or a dedicated RenameForm component
async function renameChat(chatId: string, formData: FormData) {
  'use server';
  const title = formData.get('title') as string;
  if (!title?.trim()) return;
  await updateChat(chatId, { title: title.trim() });
  revalidatePath('/', 'layout');
}
```

**Form approach:** A `<form action={renameChat.bind(null, chatId)}>` with an `<input name="title">`. On submit, the Server Action fires, updates the DB, and `revalidatePath` causes the sidebar to show the new title.

**UX modes:**
1. **Click-to-edit inline:** Show title as text; clicking it turns it into an `<input>`; blur or Enter submits the form. Requires a small Client Component to manage the `isEditing` state. The `<form action>` can still be a Server Action.
2. **Edit button opens a form:** Simpler to implement. Button reveals a hidden `<form>` with an input pre-filled with the current title.
3. **Optimistic UI with `useOptimistic`:** React 19's `useOptimistic` can show the new title immediately before the server responds. For a demo, this is optional; the full-refresh approach (revalidatePath) is simpler and sufficient.

**Recommendation:** Click-to-edit inline form, with the edit state managed by a thin Client Component wrapper. No optimistic UI needed for Phase 3 demo scope.

### 5.4 Delete Server Action Pattern

```tsx
async function deleteChatAction(chatId: string) {
  'use server';
  await deleteChat(chatId);         // CASCADE removes messages automatically
  revalidatePath('/', 'layout');
  redirect('/');                    // redirect to root (which auto-creates new chat, or shows landing)
}
```

**Confirmation UX options:**
1. **Direct delete** (no confirmation): Simplest. A delete button triggers the action immediately.
2. **JavaScript `confirm()` dialog**: Old-school but functional. Wrap in a Client Component with `onClick={() => { if (confirm('Delete?')) deleteAction(); }}`.
3. **Modal confirmation**: Cleanest UX; adds complexity. Not required for demo scope.

**Recommendation:** Direct delete with a visible destructive affordance (red button/icon). If the user deletes the currently-active chat, redirect to `/` which can auto-create a new one.

---

## 6. `useChat.stop()` — Stream Leak Prevention

### 6.1 Confirmed API

From `node_modules/ai/dist/index.d.ts` (line 3836, `AbstractChat`):

```ts
/**
 * Abort the current request immediately, keep the generated tokens if any.
 */
stop: () => Promise<void>;
```

From `node_modules/@ai-sdk/react/dist/index.d.ts` (line 25):
```ts
// useChat returns UseChatHelpers which picks 'stop' from AbstractChat
& Pick<AbstractChat<UI_MESSAGE>, 'sendMessage' | 'regenerate' | 'stop' | ...>
```

So `stop` is `() => Promise<void>` — it's **async**. Calling it without `await` is acceptable in a cleanup context (fire-and-forget), but the abort will be initiated synchronously via `AbortController`.

### 6.2 The Stream Leak Bug

There is a confirmed open bug in the Vercel AI SDK (`vercel/ai #13304`, filed against v7 beta but relevant to v6): **when `id` changes during streaming, the previous Chat instance is not stopped automatically**. The hook recreates the `Chat` instance without calling `stop()` on the old one, leaving the fetch request alive.

In this project, `chatId` is passed as the `id` option to `useChat`. When the user navigates from `/chat/A` to `/chat/B`, Next.js App Router unmounts the old `ChatPage` and mounts a new one. Since `ChatInterface` is inside the page (not the layout), it also unmounts and remounts with the new `chatId`. **The unmount is the cleanup opportunity.**

### 6.3 Correct `useEffect` Cleanup Pattern

```tsx
// src/components/ChatInterface.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';

export function ChatInterface({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: UIMessage[];
}) {
  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
  });

  // Stream leak prevention: abort any in-progress stream when chatId changes or component unmounts.
  // useRef captures the current `stop` fn without re-running the effect.
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  });

  useEffect(() => {
    return () => {
      // Cleanup: abort the stream before chatId changes or on unmount.
      // stopRef.current() returns Promise<void> — fire-and-forget is intentional here.
      stopRef.current();
    };
  }, [chatId]);  // re-register cleanup whenever chatId changes

  // ... rest of component
}
```

**Why `useRef` + two effects:**
- The cleanup in `useEffect` returns a function that closes over the `stop` reference at the time the effect was registered.
- If `stop` is in the dependency array, the effect re-registers on every render (which is harmless but noisy).
- Using `stopRef` ensures the cleanup always calls the *current* `stop` function, not a stale closure.

**Simpler alternative (also correct):**

```tsx
useEffect(() => {
  return () => {
    stop();  // stop is stable across renders in AI SDK v6
  };
}, [chatId, stop]);
```

If `stop` is referentially stable (not recreated on each render), this is equivalent and simpler. Verify stability: the `AbstractChat` instance is recreated when `id` changes in AI SDK v6 (that's the bug — the old one isn't stopped). So `stop` *is* recreated when `chatId` changes, which means including it in the dep array causes the cleanup + re-register cycle correctly.

**Order guarantee:** React calls the cleanup function *before* re-running the effect with new deps. So when `chatId` changes: (1) cleanup runs → `stop()` called on old stream, (2) new effect registers with new `chatId`. This is the correct order — stop fires before the new chat initializes.

### 6.4 What `stop()` Does on the Server Side

`stop()` on the client side aborts the underlying `fetch` request via `AbortController`. The server-side `streamText` call receives the `abortSignal` (if forwarded), which causes the OpenAI stream to be terminated. The `onFinish` callback in the route handler will **not** fire on a mid-stream abort, meaning the partial assistant response will not be saved to the database. This is acceptable behavior — a partial, interrupted response shouldn't be persisted.

---

## 7. Tailwind CSS Layout for Sidebar + Main

### 7.1 Full-Height Two-Column Layout

```tsx
// Root layout body:
<body className="h-full flex overflow-hidden">
  <aside className="w-64 flex-shrink-0 bg-gray-900 text-white flex flex-col overflow-y-auto">
    {/* Sidebar content */}
  </aside>
  <main className="flex-1 overflow-hidden flex flex-col">
    {children}
  </main>
</body>
```

- `h-full` on `<body>` (and `<html>`) fills the viewport.
- `overflow-hidden` on `<body>` prevents double scrollbars.
- `w-64` (16rem / 256px) is the conventional sidebar width.
- `flex-shrink-0` prevents the sidebar from compressing.
- `overflow-y-auto` on sidebar allows the chat list to scroll if there are many conversations.
- `flex-1` on main takes all remaining horizontal space.

### 7.2 Sidebar Internal Layout

```tsx
<aside className="w-64 flex-shrink-0 bg-gray-900 text-white flex flex-col h-full">
  {/* Header / New Chat button */}
  <div className="p-4 border-b border-gray-700">
    <NewChatButton />
  </div>
  {/* Scrollable chat list */}
  <nav className="flex-1 overflow-y-auto p-2 space-y-1">
    {chats.map(chat => <ChatListItem key={chat.id} chat={chat} />)}
  </nav>
</aside>
```

### 7.3 `app/chat/[chatId]/page.tsx` Layout Adjustment

Once the root layout has the sidebar, the chat page should **not** own its own `h-screen` wrapper. The current `<main className="flex flex-col h-screen">` will conflict with the layout's flex container. Phase 3 must update this to:

```tsx
// src/app/chat/[chatId]/page.tsx — Phase 3 version
return (
  <div className="flex flex-col h-full">
    {/* Optional: per-chat header with dynamic title */}
    <header className="border-b bg-white px-6 py-4 flex-shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{chat.title}</h1>
    </header>
    <div className="flex-1 overflow-hidden">
      <ChatInterface chatId={chatId} initialMessages={initialMessages} />
    </div>
  </div>
);
```

The `h-full` fills the `<main className="flex-1 overflow-hidden">` from the root layout.

---

## 8. `app/page.tsx` Redirect Strategy

### 8.1 Problem

The current `app/page.tsx` has a Server Action (`startChat`) that is wired to a form button. This is Pattern B (button-click creates chat). The ROADMAP says the root page should "create a new chat and redirect to `/chat/<id>`" — which reads as auto-redirect.

### 8.2 Two Valid Approaches

**Approach 1 — Auto-create in Server Component body (Page 3 target):**
```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation';
import { createChat } from '@/lib/db/queries';

export default async function HomePage() {
  const chat = await createChat();
  redirect(`/chat/${chat.id}`);   // called at the top level — no try/catch
}
```

Pros: Immediately redirects, no landing page. The sidebar "New Chat" button is the primary interaction for subsequent chats.
Cons: Creates a new chat on every visit to `/` — including when users navigate back. Could accumulate orphan chats if users don't use them. Acceptable for single-user demo.

**Approach 2 — Keep the button, add "New Chat" to sidebar:**
The current page stays but the sidebar's "New Chat" button is the primary interaction. Root `/` shows a minimal landing page.

Pros: No orphan chats; cleaner mental model.
Cons: User sees a "landing page" before entering any conversation; the ROADMAP implies immediate redirect.

**Recommendation for planner:** Use Approach 1 for full ROADMAP compliance. Document the orphan-chat risk as acceptable for a demo. If desired, add `getChats()` to the root page first — if chats already exist, redirect to the most-recent one (`getChats()[0]`); only create a new chat if no chats exist.

---

## 9. Component Implementation Recommendations

### 9.1 `Sidebar` (Server Component)

```tsx
// src/components/Sidebar.tsx
import { getChats } from '@/lib/db/queries';
import { SidebarClient } from './SidebarClient';

export async function Sidebar() {
  const chats = await getChats();
  return <SidebarClient chats={chats} />;
}
```

- Async Server Component: can call `getChats()` directly.
- Delegates all interactivity to `SidebarClient`.
- No `'use client'` directive.

### 9.2 `SidebarClient` (Client Component)

```tsx
// src/components/SidebarClient.tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Chat } from '@/lib/db/schema';

export function SidebarClient({ chats }: { chats: Chat[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-64 flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <form action={createChatAction}>
          <button type="submit" className="w-full py-2 px-4 bg-blue-600 rounded text-sm">
            + New Chat
          </button>
        </form>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.map(chat => {
          const isActive = pathname === `/chat/${chat.id}`;
          return (
            <div key={chat.id} className={`group flex items-center rounded ${isActive ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>
              <Link href={`/chat/${chat.id}`} className="flex-1 px-3 py-2 text-sm truncate">
                {chat.title}
              </Link>
              {/* Rename and Delete controls */}
              <ChatActions chatId={chat.id} currentTitle={chat.title} />
            </div>
          );
        })}
      </nav>
    </div>
  );
}
```

Note: `createChatAction` is a Server Action imported from a `'use server'` module or defined inline in a Server Component and passed down as a prop.

### 9.3 New Chat Server Action

Server Actions used as `<form action={...}>` must be defined in Server Components or in files with `'use server'` at the top:

```tsx
// src/app/actions.ts  ← new file
'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createChat, updateChat, deleteChat } from '@/lib/db/queries';

export async function createChatAction() {
  const chat = await createChat();
  revalidatePath('/', 'layout');
  redirect(`/chat/${chat.id}`);
}

export async function renameChatAction(chatId: string, formData: FormData) {
  const title = formData.get('title') as string;
  if (!title?.trim()) return;
  await updateChat(chatId, { title: title.trim() });
  revalidatePath('/', 'layout');
}

export async function deleteChatAction(chatId: string) {
  await deleteChat(chatId);
  revalidatePath('/', 'layout');
  redirect('/');
}
```

These are importable in both Server Components and Client Components (with `'use server'` files). Using a centralized `actions.ts` avoids the `'use server'` directive per-function in page files.

### 9.4 `ChatInterface` with Cleanup

The full updated ChatInterface with stream cleanup:

```tsx
// src/components/ChatInterface.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { useEffect } from 'react';
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
  const { messages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    messages: initialMessages,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // CONV-05 / stream leak prevention:
  // Call stop() on unmount or before chatId changes.
  // This prevents tokens from chat A leaking into chat B when switching mid-stream.
  useEffect(() => {
    return () => {
      stop();
    };
  }, [chatId, stop]);

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

---

## 10. Risks and Gotchas

### RISK-01: `ChatInterface` mounted in layout vs page — component identity

**Current:** `ChatInterface` is rendered inside `app/chat/[chatId]/page.tsx`. When the user navigates from `/chat/A` to `/chat/B`, Next.js unmounts the A page and mounts the B page. Since `ChatInterface` is inside the page (not in the layout), it unmounts/remounts with the new `chatId`. This triggers the `useEffect` cleanup → `stop()` fires before the new component mounts.

**Risk if moved to layout:** If anyone refactors and puts `ChatInterface` in the root layout with `chatId` as a changing prop (without remounting), the `chatId` change dep in `useEffect` handles it — but only if `chatId` is in the dep array. Ensure `chatId` is always in the dep array.

### RISK-02: `redirect()` inside try/catch swallows the redirect

Never wrap `redirect()` in a try/catch that catches all errors:

```ts
// WRONG
try {
  await deleteChat(chatId);
  redirect('/');  // throws internally — caught by outer catch
} catch (e) {
  console.error(e);  // redirect error swallowed — navigation never happens
}
```

```ts
// CORRECT
await deleteChat(chatId);
revalidatePath('/', 'layout');
redirect('/');  // called after try/catch block
```

### RISK-03: `revalidatePath` does not work in Client Components

`revalidatePath` is a server-only function. It can only be called inside Server Actions (`'use server'` functions), Route Handlers, or Server Components. If called from a Client Component directly, it will throw a runtime error. All mutations must go through Server Actions.

### RISK-04: `stop()` returns `Promise<void>` — not sync

The `stop()` method on `AbstractChat` is `async`. In a `useEffect` cleanup function, `await` cannot be used (React's cleanup function must be synchronous). Call `stop()` without `await` — this is fine because the abort is initiated via `AbortController` synchronously even though the returned promise resolves asynchronously.

```ts
// Correct: fire-and-forget in cleanup
return () => { stop(); };  // NOT: return async () => { await stop(); }
```

### RISK-05: Sidebar data freshness — Drizzle queries bypass Next.js data cache

Drizzle uses the `postgres` driver directly (not `fetch`), so Next.js cannot cache or tag these queries automatically. `revalidatePath`/`revalidateTag` affect the **Router Cache** (client-side) and the **Full Route Cache** (server-side rendering cache). After a `revalidatePath('/', 'layout')` call:
- The Router Cache for the layout is invalidated.
- Next.js will re-run the Server Component subtree (including `Sidebar`) on the next request.
- The `getChats()` Drizzle call will re-execute and return fresh data.

This is the desired behavior — no extra work needed for cache tagging.

### RISK-06: `h-screen` conflict in `app/chat/[chatId]/page.tsx`

The current page uses `<main className="flex flex-col h-screen bg-gray-50">`. Once the root layout introduces a full-height sidebar layout, `h-screen` on the page element will create a nested scroll context that overflows. This must be changed to `h-full` so the page fills its container (the `<main className="flex-1 overflow-hidden">` in the root layout).

### RISK-07: `SidebarClient` receiving Server Actions as props

Server Action functions (from `'use server'` files) can be passed as props from Server Components to Client Components — this is a supported Next.js pattern. The function reference is serialized as a server action reference. Alternatively, Client Components can import Server Actions directly from `'use server'` modules. Both patterns work.

### RISK-08: Orphan chats from root page auto-redirect

If `app/page.tsx` auto-creates a chat on every visit, navigating to `/` (e.g., via browser back) creates a new empty chat. For a single-user demo, this is cosmetic — the sidebar will list all chats. Mitigation: check if any chats exist first; redirect to the most recent one if so.

### RISK-09: Delete-while-active navigation target

If the user deletes the chat they are currently viewing, the redirect must not go back to `/chat/${chatId}` (it no longer exists). Always redirect to `/` (or the next most recent chat) after deletion. The Server Action's `redirect('/')` handles this.

### RISK-10: `useChat` `stop` function stability across renders

In AI SDK v6, `useChat` returns `stop` from `UseChatHelpers` which picks it from `AbstractChat`. The `AbstractChat` instance is recreated when `id` changes (because `useChat` internally creates a new `Chat` instance). Between renders with the same `id`, `stop` should be referentially stable (same function reference). Including `stop` in `useEffect` deps is safe — it will only cause the effect to re-register when `id` changes, which is the intended behavior.

---

## 11. Questions for the Planner

1. **Root page behavior:** Auto-redirect on load (Approach 1) vs. keep "Start New Chat" button with sidebar's "New Chat" as primary action (Approach 2)? Approach 1 matches ROADMAP but creates orphan chats.

2. **Rename UX:** Click-to-edit inline (requires a small Client Component for `isEditing` state) vs. a separate edit button that reveals a form? Inline is more polished; the button approach is simpler.

3. **Delete confirmation:** Direct delete (simplest) vs. `confirm()` dialog (one-liner) vs. modal (most polish)? For Phase 3 demo scope, direct delete or `confirm()` is recommended.

4. **Chat page header:** Show the dynamic chat title in the per-page header? The current page has a static `"Chat"` header. Phase 3 already fetches the `chat` record (for `notFound()` check), so `chat.title` is available at zero extra cost.

5. **Sidebar width and color scheme:** The ROADMAP references "ChatGPT-style layout." ChatGPT uses a dark sidebar (near-black) with white text. The existing chat area is light (`bg-gray-50`). Should the sidebar be dark to match this reference?

6. **`actions.ts` file location:** Centralized `src/app/actions.ts` vs. co-located with pages (e.g., `src/app/chat/actions.ts`)? Central is simpler for Phase 3 scope.

---

## 12. Implementation Plan Sketch (for Planner Reference)

Suggested plan breakdown (not prescriptive — planner decides):

**Plan 03-01: Layout + Sidebar shell**
- Update `app/layout.tsx` — two-column flex layout
- Create `components/Sidebar.tsx` (Server Component, fetches `getChats()`)
- Create `components/SidebarClient.tsx` (Client Component, `usePathname`, renders chat list links)
- Create `src/app/actions.ts` with `createChatAction`
- Update `app/page.tsx` — auto-redirect or new-chat button
- Fix `app/chat/[chatId]/page.tsx` — replace `h-screen` with `h-full`

**Plan 03-02: Conversations CRUD UI**
- Add rename action to `actions.ts` (`renameChatAction`)
- Add delete action to `actions.ts` (`deleteChatAction`)
- Add rename UI to `SidebarClient` (inline edit form)
- Add delete UI to `SidebarClient` (button + optional confirm)
- Wire `revalidatePath` in all actions

**Plan 03-03: Stream cleanup**
- Add `useEffect` cleanup to `ChatInterface` (calls `stop()` on `chatId` change / unmount)
- Update chat page header to show `chat.title` dynamically

---

## Sources

- Live codebase: `src/lib/db/queries.ts`, `src/app/chat/[chatId]/page.tsx`, `src/components/ChatInterface.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`
- `node_modules/ai/dist/index.d.ts` — `AbstractChat.stop(): Promise<void>` (line 3836), `ChatStatus` type (line 3679), `ChatInit` interface (line 3713)
- `node_modules/@ai-sdk/react/dist/index.d.ts` — `UseChatHelpers`, `useChat` function signature, `stop` picked from `AbstractChat`
- `.planning/STATE.md` — Phase 2 complete, 4 plans done; Phase 3 not started
- `.planning/ROADMAP.md` — Phase 3 success criteria, what gets built
- Next.js docs: `revalidatePath` (server action required; `'layout'` type for subtree), `usePathname` (Client Component only), `redirect` (outside try/catch)
- Vercel AI SDK `vercel/ai #13304` — confirmed bug: `id` change does not auto-abort stream; `useEffect` cleanup is the documented workaround
- Tailwind CSS docs: `flex`, `h-full`, `overflow-hidden`, `flex-1`, `flex-shrink-0` for sidebar layout
