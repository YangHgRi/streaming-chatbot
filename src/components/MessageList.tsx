'use client';
import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTextContent } from '@/lib/getTextContent';

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconRefresh() {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
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
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
         <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
   );
}

function IconTrash() {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="M3 6h18" />
         <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
         <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </svg>
   );
}

// ─── ConfirmPopover ───────────────────────────────────────────────────────────
// Small inline confirmation bar that slides in below the action buttons.

function ConfirmPopover({
   action,
   isUser,
   onConfirm,
   onCancel,
}: {
   action: 'refresh' | 'delete';
   isUser: boolean;
   onConfirm: () => void;
   onCancel: () => void;
}) {
   const isDelete = action === 'delete';
   return (
      <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
         <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-sm bg-white border-gray-200">
            <span className="text-gray-600 font-medium">
               {isDelete ? '删除该消息及之后的所有对话？' : '重新生成该回复？'}
            </span>
            <button
               type="button"
               onClick={onConfirm}
               className={`px-2 py-0.5 rounded text-white text-xs font-medium transition-colors ${isDelete ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                  }`}
            >
               确认
            </button>
            <button
               type="button"
               onClick={onCancel}
               className="px-2 py-0.5 rounded text-gray-500 hover:bg-gray-100 text-xs font-medium transition-colors"
            >
               取消
            </button>
         </div>
      </div>
   );
}

// ─── MessageActions ───────────────────────────────────────────────────────────
// Inline action button row, sits below the bubble (not absolutely positioned).

function MessageActions({
   message,
   onRefresh,
   onCopy,
   onDelete,
   isUser,
}: {
   message: UIMessage;
   onRefresh: (msg: UIMessage) => void;
   onCopy: (msg: UIMessage) => void;
   onDelete: (msg: UIMessage) => void;
   isUser: boolean;
}) {
   return (
      <div className={`flex items-center gap-0.5 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
         <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-md shadow-sm px-0.5 py-0.5">
            <ActionButton
               label="重新生成"
               onClick={() => onRefresh(message)}
               className="text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            >
               <IconRefresh />
            </ActionButton>
            <ActionButton
               label="复制"
               onClick={() => onCopy(message)}
               className="text-gray-400 hover:text-green-600 hover:bg-green-50"
            >
               <IconCopy />
            </ActionButton>
            <ActionButton
               label="删除"
               onClick={() => onDelete(message)}
               className="text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
               <IconTrash />
            </ActionButton>
         </div>
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingAction {
   messageId: string;
   type: 'refresh' | 'delete';
}

// ─── MessageList ──────────────────────────────────────────────────────────────

export function MessageList({
   messages,
   isLoading,
   error,
   onRefresh,
   onCopy,
   onDelete,
   pendingAction,
   onConfirm,
   onCancel,
}: {
   messages: UIMessage[];
   isLoading: boolean;
   error?: Error;
   onRefresh: (msg: UIMessage) => void;
   onCopy: (msg: UIMessage) => void;
   onDelete: (msg: UIMessage) => void;
   pendingAction: PendingAction | null;
   onConfirm: () => void;
   onCancel: () => void;
}) {
   const bottomRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
   }, [messages, isLoading]);

   const lastMessageId = messages.at(-1)?.id;

   return (
      <div className="flex-1 overflow-y-auto p-4">
         {messages.map((message) => {
            const isUser = message.role === 'user';
            const isError = (message.metadata as Record<string, unknown>)?.isError;
            // Hide action buttons on the actively streaming message
            const isLastAndStreaming = isLoading && message.id === lastMessageId;
            const hasPendingAction = pendingAction?.messageId === message.id;

            return (
               <div
                  key={message.id}
                  // `group` drives hover-based visibility of the action row
                  className={`group mb-2 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
               >
                  {/* Bubble */}
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

                  {/* Action buttons — hidden until bubble is hovered, invisible during streaming */}
                  {!isLastAndStreaming && (
                     <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageActions
                           message={message}
                           onRefresh={onRefresh}
                           onCopy={onCopy}
                           onDelete={onDelete}
                           isUser={isUser}
                        />
                     </div>
                  )}

                  {/* Confirm popover — only shown for the message currently pending confirmation */}
                  {hasPendingAction && (
                     <ConfirmPopover
                        action={pendingAction!.type}
                        isUser={isUser}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                     />
                  )}
               </div>
            );
         })}

         {/* Streaming indicator */}
         {isLoading && (
            <div className="mb-2 flex justify-start">
               <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
               </div>
            </div>
         )}

         {/* Error bubble */}
         {error && !isLoading && (
            <div className="mb-2 flex justify-start">
               <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
                  Something went wrong. Please try again.
               </div>
            </div>
         )}

         <div ref={bottomRef} />
      </div>
   );
}
