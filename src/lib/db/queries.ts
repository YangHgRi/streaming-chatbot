import { db } from '@/lib/db';
import {
   chats,
   messages,
   type Chat,
   type Message,
   type NewMessage,
} from '@/lib/db/schema';
import { eq, asc, desc, gte, and } from 'drizzle-orm';
import { DEFAULT_CHAT_TITLE } from '@/constants';

// ─── Chat CRUD ─────────────────────────────────────────────────────────────────

export async function createChat(id?: string): Promise<Chat> {
   const chatId = id ?? crypto.randomUUID();
   const [chat] = await db
      .insert(chats)
      .values({ id: chatId, title: DEFAULT_CHAT_TITLE, titled: false })
      .returning();
   // Guard for type soundness: returning() yields [] only if INSERT produces no rows,
   // which cannot happen here (no onConflictDoNothing).
   if (!chat) throw new Error('createChat: INSERT returned no rows — this should never happen');
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
   // Only 'title' and 'titled' are accepted — updatedAt is always overwritten internally.
   data: Partial<Pick<Chat, 'title' | 'titled'>>,
): Promise<void> {
   await db
      .update(chats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chats.id, chatId));
}

export async function deleteChat(chatId: string): Promise<void> {
   // CASCADE on FK removes messages automatically
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
   // onConflictDoNothing returns [] on duplicate id — treat as success by fetching the existing row
   if (!message) {
      const [existing] = await db
         .select()
         .from(messages)
         .where(eq(messages.id, data.id));
      // Guard against the race where the row was deleted between the conflict and this SELECT.
      if (!existing) {
         throw new Error(`createMessage: conflict on id=${data.id} but row no longer exists`);
      }
      return existing;
   }
   return message;
}

// ─── Message deletion ─────────────────────────────────────────────────────────

// Delete fromMessageId and all messages created at or after it in the same chat.
// Used by the refresh and delete-message actions.
export async function deleteMessagesFrom(
   chatId: string,
   fromMessageId: string,
): Promise<void> {
   // Resolve the anchor message's createdAt so we can delete it plus everything after.
   const [anchor] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, fromMessageId), eq(messages.chatId, chatId)));
   if (!anchor) return; // already gone — nothing to do
   await db
      .delete(messages)
      .where(
         and(
            eq(messages.chatId, chatId),
            gte(messages.createdAt, anchor.createdAt),
         ),
      );
}
