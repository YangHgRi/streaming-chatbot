// src/components/Sidebar.tsx
// Server Component — no 'use client' directive.
// Fetches all chats from Postgres and passes them to SidebarClient for rendering.
// Re-fetches on every request after revalidatePath('/', 'layout') is called by a Server Action.
//
// Stub actions below will be replaced in plan 03-03 once actions.ts exists.
// They exist only to satisfy TypeScript while SidebarClient awaits real Server Actions.
import { getChats } from '@/lib/db/queries';
import { SidebarClient } from './SidebarClient';

async function stubCreateChatAction(): Promise<never> {
  'use server';
  throw new Error('createChatAction not yet implemented — wired in plan 03-03');
}

async function stubRenameChatAction(_chatId: string, _formData: FormData): Promise<void> {
  'use server';
}

async function stubDeleteChatAction(_chatId: string): Promise<never> {
  'use server';
  throw new Error('deleteChatAction not yet implemented — wired in plan 03-03');
}

export async function Sidebar() {
  const chats = await getChats();
  return (
    <SidebarClient
      chats={chats}
      createChatAction={stubCreateChatAction}
      renameChatAction={stubRenameChatAction}
      deleteChatAction={stubDeleteChatAction}
    />
  );
}
