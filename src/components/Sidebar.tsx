// src/components/Sidebar.tsx
// Async Server Component — fetches all chats and passes Server Actions as props to SidebarClient.
// Re-fetches chats on every request after revalidatePath('/', 'layout') is called.
import { getChats } from '@/lib/db/queries';
import { SidebarClient } from './SidebarClient';
import {
  createChatAction,
  renameChatAction,
  deleteChatAction,
} from '@/app/actions';

export async function Sidebar() {
  const chats = await getChats();
  return (
    <SidebarClient
      chats={chats}
      createChatAction={createChatAction}
      renameChatAction={renameChatAction}
      deleteChatAction={deleteChatAction}
    />
  );
}
