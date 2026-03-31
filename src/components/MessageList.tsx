'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTextContent } from '@/lib/getTextContent';
import { CodeBlock } from './CodeBlock';
import { ROLE_USER, ROLE_ASSISTANT } from '@/constants';

// js-hoist-regexp: compile once at module level, not inside render.
const MD_LANG_RE = /language-\w+/;

// rerender-no-inline-components + rerender-memo: stable module-level references
// prevent ReactMarkdown from re-rendering every message on unrelated state changes.
const REMARK_PLUGINS = [remarkGfm];
const MD_COMPONENTS: Components = {
   code({ className, children, ...rest }) {
      const hasLang = MD_LANG_RE.test(className ?? '');
      return (
         <CodeBlock inline={!hasLang} className={className} {...rest}>
            {children}
         </CodeBlock>
      );
   },
};

const SCROLL_NEAR_BOTTOM_PX = 150;
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

function IconEdit() {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
         <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
   );
}

function IconChevronDown({ size = 12 }: { size?: number }) {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="m6 9 6 6 6-6" />
      </svg>
   );
}

function IconChevronUp({ size = 12 }: { size?: number }) {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="m18 15-6-6-6 6" />
      </svg>
   );
}

// ─── DotPulse ────────────────────────────────────────────────────────────────
// Simple three-dot loading animation shown while waiting for the first token.

function DotPulse({ inline = false }: { inline?: boolean }) {
   const dots = (
      <div className="flex items-center gap-1.5 py-0.5">
         <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-[dot-pulse_1.2s_ease-in-out_0s_infinite]" />
         <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-[dot-pulse_1.2s_ease-in-out_0.4s_infinite]" />
         <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-[dot-pulse_1.2s_ease-in-out_0.8s_infinite]" />
      </div>
   );
   if (inline) return dots;
   return (
      <div className="mb-2 flex items-start">
         <div className="rounded-lg px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            {dots}
         </div>
      </div>
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
   action: 'refresh' | 'delete' | 'edit';
   isUser: boolean;
   onConfirm: () => void;
   onCancel: () => void;
}) {
   const isDelete = action === 'delete';
   return (
      <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
         <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
               {isDelete ? 'Delete this and all following messages?' : 'Regenerate this response?'}
            </span>
            <button
               type="button"
               onClick={onConfirm}
               className={`px-2 py-0.5 rounded text-white text-xs font-medium transition-colors ${isDelete ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
                  }`}
            >
               Confirm
            </button>
            <button
               type="button"
               onClick={onCancel}
               className="px-2 py-0.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium transition-colors"
            >
               Cancel
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
   onEdit,
   isUser,
}: {
   message: UIMessage;
   onRefresh: (msg: UIMessage) => void;
   onCopy: (msg: UIMessage) => void;
   onDelete: (msg: UIMessage) => void;
   onEdit: (msg: UIMessage) => void;
   isUser: boolean;
}) {
   return (
      <div className={`flex items-center gap-0.5 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
         <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm px-0.5 py-0.5">
            {isUser && (
               <ActionButton
                  label="Edit"
                  onClick={() => onEdit(message)}
                  className="text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30"
               >
                  <IconEdit />
               </ActionButton>
            )}
            <ActionButton
               label="Regenerate"
               onClick={() => onRefresh(message)}
               className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
               <IconRefresh />
            </ActionButton>
            <ActionButton
               label="Copy"
               onClick={() => onCopy(message)}
               className="text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
            >
               <IconCopy />
            </ActionButton>
            <ActionButton
               label="Delete"
               onClick={() => onDelete(message)}
               className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
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

// ─── EmptyState ───────────────────────────────────────────────────────────────
// Shown when there are no messages and the chat is not loading.

const SUGGESTIONS = [
   'Explain quantum computing in simple terms',
   'Write a hello world in Python',
   'What are the benefits of TypeScript?',
];

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
   return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-4 text-center select-none">
         {/* Logo / icon */}
         <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
               fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
         </div>
         <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1">How can I help you?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Start a conversation or try one of these suggestions</p>
         </div>
         <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {SUGGESTIONS.map((s) => (
               <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm"
               >
                  {s}
               </button>
            ))}
         </div>
      </div>
   );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingAction {
   messageId: string;
   type: 'refresh' | 'delete' | 'edit';
}

// ─── VersionNav ─────────────────────────────────────────────────────────────

function VersionNav({
   current,
   total,
   onPrev,
   onNext,
}: {
   current: number;
   total: number;
   onPrev: () => void;
   onNext: () => void;
}) {
   return (
      <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
         <button
            type="button"
            onClick={onPrev}
            disabled={current <= 1}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
         >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="m15 18-6-6 6-6" />
            </svg>
         </button>
         <span>{current}/{total}</span>
         <button
            type="button"
            onClick={onNext}
            disabled={current >= total}
            className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
         >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="m9 18 6-6-6-6" />
            </svg>
         </button>
      </div>
   );
}

// ─── MessageList ──────────────────────────────────────────────────────────────

// ─── EditForm ─────────────────────────────────────────────────────────────────
// Inline edit form rendered inside the bubble when editing a user message.

function EditForm({
   message,
   onSave,
   onCancel,
}: {
   message: UIMessage;
   onSave: (newText: string) => void;
   onCancel: () => void;
}) {
   const original = getTextContent(message);
   const [text, setText] = useState(original);

   const canSave = text.trim().length > 0 && text.trim() !== original.trim();

   const handleSave = () => {
      if (!canSave) return;
      onSave(text);
   };

   return (
      <div>
         <textarea
            autoFocus
            value={text}
            rows={Math.max(2, text.split('\n').length)}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
               if (e.key === 'Escape') { onCancel(); }
            }}
            className="w-full resize-none rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
         <div className="flex gap-2 mt-1 justify-end">
            <button
               type="button"
               onClick={handleSave}
               disabled={!canSave}
               className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
               Save
            </button>
            <button
               type="button"
               onClick={onCancel}
               className="px-3 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
               Cancel
            </button>
         </div>
      </div>
   );
}

export function MessageList({
   messages,
   isLoading,
   error,
   onRefresh,
   onCopy,
   onDelete,
   onEdit,
   pendingAction,
   onConfirm,
   onCancel,
   onSend,
   pastVersions,
   onRestoreVersion,
}: {
   messages: UIMessage[];
   isLoading: boolean;
   error?: Error;
   onRefresh: (msg: UIMessage) => void;
   onCopy: (msg: UIMessage) => void;
   onDelete: (msg: UIMessage) => void;
   onEdit: (msg: UIMessage, newText: string) => void;
   pendingAction: PendingAction | null;
   onConfirm: () => void;
   onCancel: () => void;
   onSend: (text: string) => void;
   pastVersions?: Record<string, string[]>;
   onRestoreVersion?: (userMsgId: string, text: string) => void;
}) {
   const scrollContainerRef = useRef<HTMLDivElement>(null);
   const bottomRef = useRef<HTMLDivElement>(null);
   const [isNearBottom, setIsNearBottom] = useState(true);
   const [showScrollBtn, setShowScrollBtn] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [versionCursors, setVersionCursors] = useState<Record<string, number>>({});
   const rafRef = useRef<number | null>(null);

   // ── Smart auto-scroll ──────────────────────────────────────────────────────
   // Only scroll to bottom if the user was already near the bottom.

   const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
      bottomRef.current?.scrollIntoView({ behavior });
   }, []);

   const handleScroll = useCallback(() => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
         rafRef.current = null;
         const el = scrollContainerRef.current;
         if (!el) return;
         const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
         const nearBottom = distFromBottom < SCROLL_NEAR_BOTTOM_PX;
         setIsNearBottom(nearBottom);
         setShowScrollBtn(!nearBottom);
      });
   }, []);

   // Auto-scroll when new messages arrive — only if near bottom
   useEffect(() => {
      if (isNearBottom) {
         scrollToBottom('smooth');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [messages, isLoading]);

   // On first load (empty → messages), jump instantly without animation
   const prevLengthRef = useRef(messages.length);
   useEffect(() => {
      if (prevLengthRef.current === 0 && messages.length > 0) {
         scrollToBottom('instant' as ScrollBehavior);
      }
      prevLengthRef.current = messages.length;
   }, [messages.length, scrollToBottom]);

   const lastMessageId = messages.at(-1)?.id;

   // True when request is sent but no assistant reply exists yet
   const isWaitingPhase =
      isLoading && (messages.length === 0 || messages.at(-1)?.role === ROLE_USER);

   // Delay switching from standalone DotPulse to bubble by 500 ms so the user
   // never sees an empty white block flash before the first token arrives.
   const [showBubble, setShowBubble] = useState(false);
   useEffect(() => {
      if (isWaitingPhase) {
         setShowBubble(false);
         return;
      }
      const t = setTimeout(() => setShowBubble(true), 500);
      return () => clearTimeout(t);
   }, [isWaitingPhase]);

   const showEmptyState = messages.length === 0 && !isLoading;

   return (
      <div
         ref={scrollContainerRef}
         onScroll={handleScroll}
         className="flex-1 overflow-y-auto p-4 relative"
      >
         {/* Empty state */}
         {showEmptyState && <EmptyState onSend={onSend} />}

         {messages.map((message) => {
            const isUser = message.role === ROLE_USER;
            // During the 500 ms delay after submission, suppress the empty
            // assistant bubble so the standalone DotPulse keeps showing.
            if (!isUser && !showBubble && isLoading && message.id === lastMessageId) {
               return null;
            }
            const isError = (message.metadata as Record<string, unknown>)?.isError;
            // Hide action buttons on the actively streaming message
            const isLastAndStreaming = isLoading && message.id === lastMessageId;
            const hasPendingAction = pendingAction?.messageId === message.id && pendingAction?.type !== 'edit';
            const isEditing = editingId === message.id;
            // Version navigation for assistant messages
            const msgIndex = messages.findIndex(m => m.id === message.id);
            const userMsgBefore = !isUser && msgIndex > 0
               ? [...messages.slice(0, msgIndex)].reverse().find(m => m.role === ROLE_USER)
               : undefined;
            const pastVers = (userMsgBefore && pastVersions) ? (pastVersions[userMsgBefore.id] ?? []) : [];
            const totalVers = pastVers.length + 1;
            // allVersions: oldest-first. pastVers is stored newest-first (index 0 = most recent old version).
            // The last slot is the original latest text from the actual message — never overwritten.
            const latestText = getTextContent(message);
            const allVersions = [...pastVers].reverse().concat([latestText]);
            // Default cursor: latest (last index). Cursor only overrides the displayed text; message.parts untouched.
            const currentVersIdx = versionCursors[userMsgBefore?.id ?? ''] ?? (totalVers - 1);
            const displayText = totalVers > 1 ? allVersions[currentVersIdx] : latestText;

            return (
               <div
                  key={message.id}
                  // `group` drives hover-based visibility of the action row
                  className={`group mb-2 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
               >
                  <div className={`flex flex-col ${isUser ? 'max-w-[75%]' : 'max-w-[85%]'}`}>

                     {/* Bubble */}
                     <div
                        className={`w-full rounded-lg px-4 py-2 ${isUser
                           ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                           : isError
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                           }`}
                     >
                        {isEditing ? (
                           <EditForm
                              message={message}
                              onSave={(newText) => { onEdit(message, newText); setEditingId(null); }}
                              onCancel={() => setEditingId(null)}
                           />
                        ) : message.role === ROLE_ASSISTANT && isError ? (
                           <span className="text-sm">Something went wrong. Please try again.</span>
                        ) : message.role === ROLE_ASSISTANT && isLastAndStreaming && !displayText ? (
                           <DotPulse inline />
                        ) : message.role === ROLE_ASSISTANT ? (
                           <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                 remarkPlugins={REMARK_PLUGINS}
                                 components={MD_COMPONENTS}
                              >
                                 {displayText}
                              </ReactMarkdown>
                           </div>
                        ) : (
                           <span className="text-sm whitespace-pre-wrap">{getTextContent(message)}</span>
                        )}
                     </div>
                  </div>

                  {/* Version navigation — shown for assistant messages with history */}
                  {!isUser && totalVers > 1 && userMsgBefore && !isLastAndStreaming && (
                     <VersionNav
                        current={currentVersIdx + 1}
                        total={totalVers}
                        onPrev={() => {
                           if (currentVersIdx > 0) {
                              const newIdx = currentVersIdx - 1;
                              setVersionCursors(prev => ({ ...prev, [userMsgBefore.id]: newIdx }));
                              onRestoreVersion?.(userMsgBefore.id, allVersions[newIdx]);
                           }
                        }}
                        onNext={() => {
                           if (currentVersIdx < totalVers - 1) {
                              const newIdx = currentVersIdx + 1;
                              setVersionCursors(prev => ({ ...prev, [userMsgBefore.id]: newIdx }));
                              onRestoreVersion?.(userMsgBefore.id, allVersions[newIdx]);
                           }
                        }}
                     />
                  )}

                  {/* Action buttons — hidden until bubble is hovered, invisible during streaming */}
                  {!isLastAndStreaming && !isEditing && (
                     <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageActions
                           message={message}
                           onRefresh={onRefresh}
                           onCopy={onCopy}
                           onDelete={onDelete}
                           onEdit={() => setEditingId(message.id)}
                           isUser={isUser}
                        />
                     </div>
                  )}

                  {/* Confirm popover — only shown for the message currently pending confirmation */}
                  {hasPendingAction && (
                     <ConfirmPopover
                        action={pendingAction?.type ?? 'delete'}
                        isUser={isUser}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                     />
                  )}
               </div>
            );
         })}

         {/* Thinking phase indicator (submitted → no assistant message yet) */}
         {(isWaitingPhase || (isLoading && !showBubble)) && <DotPulse />}

         {/* Error bubble */}
         {error && !isLoading && (
            <div className="mb-2 flex justify-start">
               <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                  Something went wrong. Please try again.
               </div>
            </div>
         )}

         <div ref={bottomRef} />

         {/* Scroll-to-bottom FAB */}
         {showScrollBtn && (
            <button
               type="button"
               onClick={() => scrollToBottom('smooth')}
               aria-label="Scroll to bottom"
               className="fixed bottom-28 sm:bottom-24 right-6 z-20 w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 transition-all animate-fade-in"
            >
               <IconChevronDown size={16} />
            </button>
         )}
      </div>
   );
}
