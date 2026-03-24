---
id: 02-01-db-query-layer
phase: 2
wave: 1
depends_on: []
files_modified:
  - src/lib/db/queries.ts
autonomous: true
requirements: [PERS-01, PERS-02, PERS-03, PERS-04]
---

# Plan 01: DB Query Layer

## Objective

Create `src/lib/db/queries.ts` with all 7 typed Drizzle ORM CRUD functions used by Phase 2. This plan has no dependencies and unblocks Plans 02 and 03 in Wave 2.

<tasks>

<task id="T01" title="Create src/lib/db/queries.ts with all 7 CRUD functions">
  <read_first>
  - `src/lib/db/schema.ts` — Drizzle table definitions for `chats` and `messages`, inferred types `Chat`, `Message`, `NewMessage`
  - `src/lib/db/index.ts` — `db` export pattern (import via `@/lib/db`)
  </read_first>

  <action>
  Create `src/lib/db/queries.ts` with the following exact content:

  ```typescript
  import { db } from '@/lib/db';
  import {
    chats,
    messages,
    type Chat,
    type Message,
    type NewMessage,
  } from '@/lib/db/schema';
  import { eq, asc, desc } from 'drizzle-orm';

  // ─── Chat CRUD ─────────────────────────────────────────────────────────────────

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

  // ─── Message CRUD ──────────────────────────────────────────────────────────────

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

  Notes:
  - `Chat` = `typeof chats.$inferSelect` — used for return types
  - `Message` = `typeof messages.$inferSelect` — used for return types
  - `NewMessage` = `typeof messages.$inferInsert` — used for insert params
  - `crypto.randomUUID()` is the established ID generation pattern (no nanoid)
  - `getChats()` takes no argument — returns all chats ordered by `updatedAt` desc
  - `deleteChat()` uses CASCADE FK — messages are auto-deleted when chat is deleted
  </action>

  <acceptance_criteria>
  - `src/lib/db/queries.ts` exists
  - `src/lib/db/queries.ts` contains `export async function createChat(`
  - `src/lib/db/queries.ts` contains `export async function getChats(`
  - `src/lib/db/queries.ts` contains `export async function getChat(`
  - `src/lib/db/queries.ts` contains `export async function updateChat(`
  - `src/lib/db/queries.ts` contains `export async function deleteChat(`
  - `src/lib/db/queries.ts` contains `export async function getMessages(`
  - `src/lib/db/queries.ts` contains `export async function createMessage(`
  - `src/lib/db/queries.ts` contains `import { db } from '@/lib/db'`
  - `src/lib/db/queries.ts` contains `.returning()`
  - `src/lib/db/queries.ts` contains `eq, asc, desc`
  </acceptance_criteria>
</task>

</tasks>

<verification>
Run TypeScript compiler check:
```bash
npx tsc --noEmit
```
Expected: No TypeScript errors in `src/lib/db/queries.ts`.

Manual check: Confirm all 7 function names are exported from the file:
```bash
grep "^export async function" src/lib/db/queries.ts
```
Expected output (7 lines):
```
export async function createChat(
export async function getChats(
export async function getChat(
export async function updateChat(
export async function deleteChat(
export async function getMessages(
export async function createMessage(
```
</verification>

<must_haves>
- `src/lib/db/queries.ts` exports all 7 functions: `createChat`, `getChats`, `getChat`, `updateChat`, `deleteChat`, `getMessages`, `createMessage`
- All functions use `@/lib/db` import (not a relative path)
- All functions have explicit TypeScript return types
- TypeScript compiles without errors
- `createMessage` accepts `Omit<NewMessage, 'createdAt'>` — caller provides `id`, `chatId`, `role`, `content`
</must_haves>
