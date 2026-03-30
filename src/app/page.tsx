import { redirect } from 'next/navigation';
import { getChats, createChat } from '@/lib/db/queries';

export default async function HomePage() {
   const [latest] = await getChats(); // already sorted by updatedAt DESC
   const chat = latest ?? (await createChat());
   redirect(`/chat/${chat.id}`);
}
