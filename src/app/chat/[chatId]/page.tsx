import type { UIMessage } from 'ai';
import { getMessages } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';
import { notFound } from 'next/navigation';
import { getChat } from '@/lib/db/queries';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  // IMPORTANT: params is a Promise in Next.js 15+. Must await before accessing.
  const { chatId } = await params;

  // Validate the chat exists — return 404 if chatId is invalid
  const chat = await getChat(chatId);
  if (!chat) notFound();

  // Fetch message history from Postgres (PERS-04)
  const dbMessages = await getMessages(chatId);

  // Convert DB Message[] to UIMessage[] shape expected by useChat's `messages` option.
  // AI SDK v6: UIMessage requires id, role, parts array, and metadata. No top-level `content` field.
  const initialMessages: UIMessage[] = dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
    metadata: {},
  }));

  return (
    <main className="flex flex-col h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatInterface chatId={chatId} initialMessages={initialMessages} />
      </div>
    </main>
  );
}
