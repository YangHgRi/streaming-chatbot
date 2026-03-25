import { redirect } from 'next/navigation';
import { createChat } from '@/lib/db/queries';

// Auto-creates a new chat on every visit to `/` and redirects immediately.
// The sidebar's "New Chat" button (added in plan 03-03) is the primary creation
// entry point for subsequent chats.
// Note: visiting `/` via back-button navigation will create a new orphan chat —
// this is acceptable for a single-user demo.
export default async function HomePage() {
  const chat = await createChat();
  redirect(`/chat/${chat.id}`);
}
