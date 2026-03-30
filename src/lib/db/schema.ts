import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { DEFAULT_CHAT_TITLE } from '@/constants';

export const chats = pgTable('chats', {
   id: text('id').primaryKey(),
   title: text('title').notNull().default(DEFAULT_CHAT_TITLE),
   titled: boolean('titled').notNull().default(false),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
   'messages',
   {
      id: text('id').primaryKey(),
      chatId: text('chat_id')
         .notNull()
         .references(() => chats.id, { onDelete: 'cascade' }),
      role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
      content: text('content').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
   },
   (table) => ({
      chatIdIdx: index('messages_chat_id_idx').on(table.chatId),
   }),
);

// Inferred TypeScript types — used throughout the app
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
