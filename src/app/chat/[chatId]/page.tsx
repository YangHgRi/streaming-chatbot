import type { UIMessage } from 'ai';
import { getMessages, getChat } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';
import { notFound } from 'next/navigation';
import { createChatAction } from '@/app/actions';
import { MobileSidebarToggle } from '@/components/MobileSidebarToggle';
import { ERROR_SENTINEL_PREFIX } from '@/constants';

export default async function ChatPage({
   params,
}: {
   params: Promise<{ chatId: string }>;
}) {
   // params is a Promise in Next.js 15+; must await before accessing.
   const { chatId } = await params;

   // async-parallel: fire both queries simultaneously — getMessages returns []
   // harmlessly even if the chat turns out to be missing.
   const [chat, dbMessages] = await Promise.all([
      getChat(chatId),
      getMessages(chatId),
   ]);
   if (!chat) notFound();
   // Fetch message history and convert to UIMessage[] for useChat.
   // AI SDK v6 requires id, role, parts array, and metadata — no top-level content field.
   const initialMessages: UIMessage[] = dbMessages
      // Filter out 'system' role rows before casting — schema allows the 'system'
      // value but the cast below only accepts 'user' | 'assistant'.
      .filter((msg): msg is typeof msg & { role: 'user' | 'assistant' } =>
         msg.role === 'user' || msg.role === 'assistant',
      )
      .map((msg) => {
         // Detect persisted error sentinel and expose it via metadata.
         const isError = msg.content.startsWith(ERROR_SENTINEL_PREFIX);
         const displayContent = isError
            ? msg.content.slice(ERROR_SENTINEL_PREFIX.length)
            : msg.content;
         return {
            id: msg.id,
            role: msg.role,
            parts: [{ type: 'text' as const, text: displayContent }],
            metadata: { isError },
         };
      });

   return (
      <div className="flex flex-col h-full bg-gray-50">
         <header className="border-b border-gray-200 bg-white px-4 py-4 flex-shrink-0 flex items-center gap-3">
            {/* Mobile hamburger — hidden on md+ (sidebar always visible there) */}
            <MobileSidebarToggle />
            <h1 className="text-lg font-semibold text-gray-900 truncate" title={chat.title}>{chat.title}</h1>
         </header>
         <div className="flex-1 overflow-hidden">
            <ChatInterface chatId={chatId} initialMessages={initialMessages} onNewChat={createChatAction} titled={chat.titled ?? false} />
         </div>
      </div>
   );
}
