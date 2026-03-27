import { redirect } from 'next/navigation';
import { getChats, createChat } from '@/lib/db/queries';

// Issue #8: reuse the most-recent existing chat instead of always creating a new one.
// This prevents orphan "New Chat" records from accumulating every time the user
// visits `/` (back-button navigation, opening a new tab, etc.).
// A fresh chat is only created when no conversations exist yet.
export default async function HomePage() {
   const [latest] = await getChats(); // already sorted by updatedAt DESC
   const chat = latest ?? (await createChat());
   redirect(`/chat/${chat.id}`);
}
