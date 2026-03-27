import type { UIMessage } from 'ai';
import { getMessages, getChat } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';
import { notFound } from 'next/navigation';

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
   const initialMessages: UIMessage[] = dbMessages
      // V3: filter out 'system' role rows before casting to UIMessage.
      // schema.ts allows role = 'user' | 'assistant' | 'system', so Drizzle
      // infers Message.role as that union. The 'as' cast below only accepts
      // 'user' | 'assistant'; a runtime 'system' value would silently pass
      // the cast but break rendering. Filter first, then the narrowing is safe.
      .filter((msg): msg is typeof msg & { role: 'user' | 'assistant' } =>
         msg.role === 'user' || msg.role === 'assistant',
      )
      .map((msg) => ({
         id: msg.id,
         role: msg.role,
         parts: [{ type: 'text' as const, text: msg.content }],
         metadata: {},
      }));

   return (
      <div className="flex flex-col h-full bg-gray-50">
         <header className="border-b border-gray-200 bg-white px-6 py-4 flex-shrink-0">
            <h1 className="text-lg font-semibold text-gray-900">{chat.title}</h1>
         </header>
         <div className="flex-1 overflow-hidden">
            <ChatInterface chatId={chatId} initialMessages={initialMessages} />
         </div>
      </div>
   );
}
