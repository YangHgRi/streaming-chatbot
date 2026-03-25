'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createChat, updateChat, deleteChat } from '@/lib/db/queries';

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
  const title = formData.get('title') as string;
  if (!title?.trim()) return;
  await updateChat(chatId, { title: title.trim() });
  revalidatePath('/', 'layout');
}

// CONV-05: Delete a conversation and all its messages.
// deleteChat uses CASCADE on the messages foreign key — all child message rows are
// removed automatically by Postgres. No separate deleteMessages() call needed.
// Redirects to '/' after deletion. The root page (app/page.tsx) will auto-create
// a new chat and redirect to it, so the user always lands in a conversation.
export async function deleteChatAction(chatId: string) {
  await deleteChat(chatId);
  revalidatePath('/', 'layout');
  redirect('/');
}
