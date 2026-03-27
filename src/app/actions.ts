'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createChat, updateChat, deleteChat, getChats } from '@/lib/db/queries';

// CONV-01: Create a new chat and navigate to it.
// revalidatePath is called BEFORE redirect so the sidebar data is fresh when the
// redirected page renders (Router Cache is busted before the new URL loads).
export async function createChatAction() {
   const chat = await createChat();
   revalidatePath('/', 'layout');
   redirect(`/chat/${chat.id}`);
}

// CONV-04: Rename a conversation.
// chatId is pre-bound via .bind(null, chat.id) in SidebarClient's form action.
// formData carries the 'title' input field value.
// Guard: returns early on blank/whitespace — prevents saving empty titles.
// No redirect — user stays on the current chat; sidebar title updates via revalidatePath.
export async function renameChatAction(chatId: string, formData: FormData) {
   // W3: FormData.get() returns string | File | null.
   // The previous 'as string' cast bypassed the File branch — if a file field with
   // the same name were submitted, .trim() would throw TypeError at runtime.
   // A typeof guard narrows to string safely before any further operations.
   const raw = formData.get('title');
   if (typeof raw !== 'string' || !raw.trim()) return;
   await updateChat(chatId, { title: raw.trim() });
   revalidatePath('/', 'layout');
}

// CONV-05: Delete a conversation and all its messages.
// deleteChat uses CASCADE on the messages foreign key — all child message rows are
// removed automatically by Postgres. No separate deleteMessages() call needed.
//
// N5 fix: redirect to the next available chat instead of always going to '/';
// navigating to '/' would create a fresh empty chat even when others still exist.
export async function deleteChatAction(chatId: string) {
   // Fetch the chat list BEFORE deleting so we can find a sibling to redirect to
   const allChats = await getChats();
   const nextChat = allChats.find((c) => c.id !== chatId);

   await deleteChat(chatId);
   revalidatePath('/', 'layout');

   if (nextChat) {
      redirect(`/chat/${nextChat.id}`);
   } else {
      // No chats remain — let page.tsx create a fresh one
      redirect('/');
   }
}
