'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createChat, updateChat, deleteChat, getChats, deleteMessagesFrom } from '@/lib/db/queries';

// Create a new chat and navigate to it.
// revalidatePath is called BEFORE redirect so the sidebar data is fresh
// when the redirected page renders.
export async function createChatAction() {
   let chatId: string;
   try {
      const chat = await createChat();
      chatId = chat.id;
   } catch {
      throw new Error('Failed to create chat. Please try again.');
   }
   revalidatePath('/', 'layout');
   redirect(`/chat/${chatId}`);
}

// Rename a conversation.
export async function renameChatAction(chatId: string, formData: FormData) {
   // FormData.get() returns string | File | null; typeof guard narrows to string safely.
   const raw = formData.get('title');
   if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error('Title cannot be empty.');
   }
   try {
      await updateChat(chatId, { title: raw.trim() });
   } catch {
      throw new Error('Failed to rename chat. Please try again.');
   }
   revalidatePath('/', 'layout');
}

// Delete a conversation and all its messages.
// deleteChat uses CASCADE on the FK — child message rows are removed automatically.
export async function deleteChatAction(chatId: string) {
   let nextChatId: string | undefined;
   try {
      // Fetch the chat list BEFORE deleting to find a sibling to redirect to.
      const allChats = await getChats();
      const nextChat = allChats.find((c) => c.id !== chatId);
      nextChatId = nextChat?.id;
      await deleteChat(chatId);
   } catch {
      throw new Error('Failed to delete chat. Please try again.');
   }
   revalidatePath('/', 'layout');
   if (nextChatId) {
      redirect(`/chat/${nextChatId}`);
   } else {
      // No chats remain — let page.tsx create a fresh one
      redirect('/');
   }
}

// Delete a message and everything after it in the same chat.
// Called by both 'refresh' and 'delete' message actions.
export async function deleteMessagesFromAction(
   chatId: string,
   fromMessageId: string,
): Promise<void> {
   try {
      await deleteMessagesFrom(chatId, fromMessageId);
   } catch (err) {
      throw new Error(
         `Failed to delete messages: ${err instanceof Error ? err.message : String(err)}`,
      );
   }
   revalidatePath(`/chat/${chatId}`);
}
