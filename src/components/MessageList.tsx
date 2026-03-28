'use client';
import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTextContent } from '@/lib/getTextContent';

// Icons ─────────────────────────────────────────────────────────────────────

function IconRefresh() {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
         <path d="M21 3v5h-5" />
         <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
         <path d="M8 16H3v5" />
      </svg>
   );
}

function IconCopy() {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
         <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
   );
}

function IconTrash() {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="M3 6h18" />
         <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
         <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
   );
}

// MessageActions — shown on hover below the message bubble ──────────────────

function MessageActions({
   message,
   onRefresh,
   onCopy,
   onDelete,
   isUser,
   // confirmingDelete: when true the delete button shows a "confirm" state
   confirmingDelete,
}: {
   message: UIMessage;
   onRefresh: (msg: UIMessage) => void;
   onCopy: (msg: UIMessage) => void;
   onDelete: (msg: UIMessage) => void;
   isUser: boolean;
   confirmingDelete: boolean;
}) {
   return (
      <div
         className={`
            absolute -bottom-8 flex items-center gap-0.5 bg-white border border-gray-200
            rounded-md shadow-sm px-0.5 py-0.5 z-10
            ${isUser ? 'right-0' : 'left-0'}
         `}
      >
         <ActionButton
            label="重新生成"
            onClick={() => onRefresh(message)}
            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
         >
            <IconRefresh />
         </ActionButton>
         <ActionButton
            label="复制"
            onClick={() => onCopy(message)}
            className="text-gray-500 hover:text-green-600 hover:bg-green-50"
         >
            <IconCopy />
         </ActionButton>
         {/* Two-step delete: first click arms (red highlight), second click confirms */}
         <ActionButton
            label={confirmingDelete ? '确认删除？' : '删除'}
            onClick={() => onDelete(message)}
            className={
               confirmingDelete
                  ? 'text-white bg-red-500 hover:bg-red-600'
                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
            }
         >
            <IconTrash />
         </ActionButton>
      </div>
   );
}

function ActionButton({
   label,
   onClick,
   className,
   children,
}: {
   label: string;
   onClick: () => void;
   className?: string;
   children: React.ReactNode;
}) {
   return (
      <button
         type="button"
         title={label}
         onClick={onClick}
         className={`p-1.5 rounded transition-colors ${className ?? ''}`}
      >
         {children}
      </button>
   );
}

// MessageList ────────────────────────────────────────────────────────────────

export function MessageList({
   messages,
   isLoading,
   error,
   onRefresh,
   onCopy,
   onDelete,
   confirmingDeleteId,
}: {
   messages: UIMessage[];
   isLoading: boolean;
   error?: Error;
   onRefresh: (msg: UIMessage) => void;
   onCopy: (msg: UIMessage) => void;
   onDelete: (msg: UIMessage) => void;
   // The message id currently in the "armed" delete-confirm state (or null)
   confirmingDeleteId: string | null;
}) {
   const bottomRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
   }, [messages, isLoading]);

   const lastMessageId = messages.at(-1)?.id;

   return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
         {messages.map((message) => {
            const isUser = message.role === 'user';
            const isError = (message.metadata as Record<string, unknown>)?.isError;
            // B3 fix: suppress action buttons on the last message while streaming
            const isLastAndStreaming = isLoading && message.id === lastMessageId;

            return (
               // pb-10 reserves space for the -bottom-8 action bar so it never
               // overlaps the next message row. (B2 fix: was pb-2)
               <div
                  key={message.id}
                  className={`relative group flex pb-10 ${isUser ? 'justify-end' : 'justify-start'}`}
               >
                  <div
                     className={`max-w-[80%] rounded-lg px-4 py-2 ${isUser
                           ? 'bg-gray-200 text-gray-900'
                           : isError
                              ? 'bg-red-50 border border-red-200 text-red-700'
                              : 'bg-white border border-gray-200 text-gray-900'
                        }`}
                  >
                     {message.role === 'assistant' && isError ? (
                        <span className="text-sm">Something went wrong. Please try again.</span>
                     ) : message.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none">
                           <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {getTextContent(message)}
                           </ReactMarkdown>
                        </div>
                     ) : (
                        <span className="text-sm whitespace-pre-wrap">{getTextContent(message)}</span>
                     )}
                  </div>

                  {/* Hide action buttons entirely on the last message while streaming */}
                  {!isLastAndStreaming && (
                     <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageActions
                           message={message}
                           onRefresh={onRefresh}
                           onCopy={onCopy}
                           onDelete={onDelete}
                           isUser={isUser}
                           confirmingDelete={confirmingDeleteId === message.id}
                        />
                     </div>
                  )}
               </div>
            );
         })}

         {isLoading && (
            <div className="flex justify-start">
               <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
               </div>
            </div>
         )}

         {error && !isLoading && (
            <div className="flex justify-start">
               <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
                  Something went wrong. Please try again.
               </div>
            </div>
         )}

         <div ref={bottomRef} />
      </div>
   );
}
