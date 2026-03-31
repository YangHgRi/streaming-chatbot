import type { UIMessage } from 'ai';
import { getMessages, getChat } from '@/lib/db/queries';
import { ChatInterface } from '@/components/ChatInterface';
import { notFound } from 'next/navigation';
import { createChatAction, updateSystemPromptAction, generateShareLinkAction } from '@/app/actions';
import { MobileSidebarToggle } from '@/components/MobileSidebarToggle';
import { ShareButton } from '@/components/ShareButton';
import { SystemPromptButton } from '@/components/SystemPromptButton';
import { ExportDropdown } from '@/components/ExportDropdown';
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
         <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-5 shrink-0 flex items-center gap-3">
            {/* Mobile hamburger — hidden on md+ (sidebar always visible there) */}
            <MobileSidebarToggle />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={chat.title}>{chat.title}</h1>
            {/* Export dropdown — zero-JS <details>/<summary> pattern */}
            {/* Action buttons: Share + Export */}
            <div className="ml-auto flex items-center gap-1">
               <ShareButton chatId={chatId} onShare={generateShareLinkAction} />
               <ExportDropdown chatId={chatId} />
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
