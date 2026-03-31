import type { UIMessage } from 'ai';
import { getMessages, getChat } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';
import { notFound } from 'next/navigation';
import { createChatAction, updateSystemPromptAction, generateShareLinkAction } from '@/app/actions';
import { MobileSidebarToggle } from '@/components/MobileSidebarToggle';
import { ShareButton } from '@/components/ShareButton';
import { SystemPromptButton } from '@/components/SystemPromptButton';
import { ERROR_SENTINEL_PREFIX, ROLE_USER, ROLE_ASSISTANT } from '@/constants';

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
      .filter((msg): msg is typeof msg & { role: typeof ROLE_USER | typeof ROLE_ASSISTANT } =>
         msg.role === ROLE_USER || msg.role === ROLE_ASSISTANT,
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
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
         <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-5 flex-shrink-0 flex items-center gap-3">
            {/* Mobile hamburger — hidden on md+ (sidebar always visible there) */}
            <MobileSidebarToggle />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={chat.title}>{chat.title}</h1>
            {/* Export dropdown — zero-JS <details>/<summary> pattern */}
            {/* Action buttons: Share + Export */}
            <div className="ml-auto flex items-center gap-1">
               <ShareButton chatId={chatId} onShare={generateShareLinkAction} />
               {/* Export dropdown — zero-JS <details>/<summary> pattern */}
               <details className="relative">
                  <summary className="list-none cursor-pointer p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 text-xs font-medium">
                     <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                     </svg>
                     <span className="hidden sm:inline">Export</span>
                  </summary>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                     <a href={`/api/chat/${chatId}/export?format=markdown`} download className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <span>📄</span> Markdown (.md)
                     </a>
                     <a href={`/api/chat/${chatId}/export?format=json`} download className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <span>📋</span> JSON
                     </a>
                  </div>
               </details>
               <SystemPromptButton
                  chatId={chatId}
                  initialPrompt={chat.systemPrompt ?? ''}
                  onSave={updateSystemPromptAction.bind(null, chatId)}
               />
            </div>
         </header>
         <div className="flex-1 overflow-hidden">
            <ChatInterface
               chatId={chatId}
               initialMessages={initialMessages}
               onNewChat={createChatAction}
               titled={chat.titled ?? false}
               systemPrompt={chat.systemPrompt ?? ''}
               onUpdateSystemPrompt={updateSystemPromptAction.bind(null, chatId)}
            />
         </div>
      </div>
   );
}
