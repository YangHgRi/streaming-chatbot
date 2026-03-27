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
      .onConflictDoNothing()
      .returning();
   // onConflictDoNothing returns an empty array on duplicate id — treat as success
   if (!message) {
      const [existing] = await db
         .select()
         .from(messages)
         .where(eq(messages.id, data.id));
      // U3: guard against the race where the row was deleted between the
      // conflict and this SELECT (e.g. concurrent delete in another tab).
      if (!existing) {
         throw new Error(`createMessage: conflict on id=${data.id} but row no longer exists`);
      }
      return existing;
   }
   return message;
}
