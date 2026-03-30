'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTextContent } from '@/lib/getTextContent';
import { CodeBlock } from './CodeBlock';

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
const THINKING_COLLAPSE_DELAY_MS = 600;

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

function IconBrain({ size = 13 }: { size?: number }) {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
         <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
         <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
         <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
         <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
         <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
         <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
         <path d="M6 18a4 4 0 0 1-1.967-.516" />
         <path d="M19.967 17.484A4 4 0 0 1 18 18" />
      </svg>
   );
}

// ─── ThinkingLines ────────────────────────────────────────────────────────────
// Renders blurred / ghost text lines to simulate "thinking" content.

const THINKING_LINES = [
   { w: 'w-4/5', delay: 'animate-thinking' },
   { w: 'w-3/5', delay: 'animate-thinking-delay-1' },
   { w: 'w-2/3', delay: 'animate-thinking-delay-2' },
   { w: 'w-1/2', delay: 'animate-thinking-delay-3' },
   { w: 'w-3/4', delay: 'animate-thinking' },
];

function ThinkingLines() {
   return (
      <div className="flex flex-col gap-2 py-0.5">
         {THINKING_LINES.map((line, i) => (
            <div
               key={i}
               className={`h-3 rounded-full bg-gray-300 blur-[2px] ${line.w} ${line.delay}`}
            />
         ))}
      </div>
   );
}

// ─── StandaloneThinkingBlock ──────────────────────────────────────────────────
// Floating block shown during "submitted" phase (no assistant message yet).

function StandaloneThinkingBlock() {
   return (
      <div className="mb-2 flex justify-start animate-fade-in">
         <div className="max-w-[80%] rounded-lg px-4 py-3 bg-white border border-gray-200">
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-3">
               <span className="text-gray-400 animate-thinking">
                  <IconBrain size={14} />
               </span>
               <span className="text-xs font-medium text-gray-400 animate-thinking tracking-wide">
                  Thinking…
               </span>
            </div>
            <ThinkingLines />
         </div>
      </div>
   );
}

// ─── ThinkingPill ─────────────────────────────────────────────────────────────
// Collapsed/expanded pill shown above an assistant bubble that went through
// the thinking phase.  During streaming it shows animated lines; after
// streaming it collapses by default and can be toggled.

function ThinkingPill({
   isStreaming,
   expanded,
   onToggle,
}: {
   isStreaming: boolean;
   expanded: boolean;
   onToggle: () => void;
}) {
   return (
      <div className="w-full rounded-lg border border-gray-200 bg-white overflow-hidden mb-1 animate-fade-in">
         {/* Pill header — always visible */}
         <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
         >
            <span className={`text-gray-400 ${isStreaming ? 'animate-thinking' : ''}`}>
               <IconBrain size={13} />
            </span>
            <span className={`text-xs font-medium text-gray-400 flex-1 tracking-wide ${isStreaming ? 'animate-thinking' : ''}`}>
               {isStreaming ? 'Thinking…' : 'Done thinking'}
            </span>
            <span className="text-gray-300">
               {expanded ? <IconChevronUp /> : <IconChevronDown />}
            </span>
         </button>

         {/* Expanded content */}
         {expanded && (
            <div className="w-0 min-w-full px-3 pb-3 pt-0.5 border-t border-gray-100 overflow-hidden">
               {isStreaming ? (
                  <ThinkingLines />
               ) : (
                  <p className="text-xs text-gray-400 italic select-none">
                     AI has finished reasoning. Answer shown below.
                  </p>
               )}
            </div>
         )}
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
               className="px-2 py-0.5 rounded text-gray-500 hover:bg-gray-100 text-xs font-medium transition-colors"
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
               label="Regenerate"
               onClick={() => onRefresh(message)}
               className="text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            >
               <IconRefresh />
            </ActionButton>
            <ActionButton
               label="Copy"
               onClick={() => onCopy(message)}
               className="text-gray-400 hover:text-green-600 hover:bg-green-50"
            >
               <IconCopy />
            </ActionButton>
            <ActionButton
               label="Delete"
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
            <h2 className="text-xl font-semibold text-gray-800 mb-1">How can I help you?</h2>
            <p className="text-sm text-gray-500">Start a conversation or try one of these suggestions</p>
         </div>
         <div className="flex flex-wrap gap-2 justify-center max-w-lg">
            {SUGGESTIONS.map((s) => (
               <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
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
   onSend,
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
   onSend: (text: string) => void;
}) {
   const scrollContainerRef = useRef<HTMLDivElement>(null);
   const bottomRef = useRef<HTMLDivElement>(null);
   const [isNearBottom, setIsNearBottom] = useState(true);
   const [showScrollBtn, setShowScrollBtn] = useState(false);
   const rafRef = useRef<number | null>(null);

   // ── Smart auto-scroll ──────────────────────────────────────────────────────
   // Only scroll to bottom if the user was already near the bottom.

   const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
      bottomRef.current?.scrollIntoView({ behavior });
   }, []);

   // Track if user is near bottom
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

   // ── Thinking-pill tracking ────────────────────────────────────────────────
   // When `status` transitions from 'submitted' → 'streaming', the first
   // assistant message appears.  We record its id so we can show a thinking
   // pill above it even after streaming completes.
   //
   // thinkingIds  – set of assistant message ids that had a thinking phase
   // expandedIds  – set of those ids whose pill is currently expanded
   const [thinkingIds, setThinkingIds] = useState<Set<string>>(new Set());
   const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

   // Track the previous last-message id so we can detect the moment a new
   // assistant message appears while we are still loading (= submitted→streaming).
   const prevLastIdRef = useRef<string | undefined>(undefined);

   useEffect(() => {
      const currentLastId = messages.at(-1)?.id;
      const currentLastRole = messages.at(-1)?.role;

      if (
         isLoading &&
         currentLastRole === 'assistant' &&
         currentLastId !== undefined &&
         currentLastId !== prevLastIdRef.current
      ) {
         // A new assistant message appeared during loading → it had a thinking phase
         setThinkingIds((prev) => new Set(prev).add(currentLastId));
         // Start expanded so the user sees the blurred lines while streaming
         setExpandedIds((prev) => new Set(prev).add(currentLastId));
      }

      prevLastIdRef.current = currentLastId;
   }, [messages, isLoading]);

   // When streaming ends for a message, auto-collapse the pill after a short delay
   const prevIsLoadingRef = useRef(isLoading);
   useEffect(() => {
      if (prevIsLoadingRef.current && !isLoading) {
         // Streaming just finished — collapse the pill for the last assistant message
         const lastId = messages.at(-1)?.id;
         if (lastId && thinkingIds.has(lastId)) {
            const timer = setTimeout(() => {
               setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(lastId);
                  return next;
               });
            }, THINKING_COLLAPSE_DELAY_MS);
            return () => clearTimeout(timer);
         }
      }
      prevIsLoadingRef.current = isLoading;
   }, [isLoading, messages, thinkingIds]);

   // rerender-memo: useCallback gives togglePill a stable reference so that
   // ThinkingPill's onToggle prop does not change on every MessageList render.
   const togglePill = useCallback((id: string) => {
      setExpandedIds((prev) => {
         const next = new Set(prev);
         if (next.has(id)) {
            next.delete(id);
         } else {
            next.add(id);
         }
         return next;
      });
   }, []);

   // True when request is sent but no assistant reply exists yet
   const isThinkingPhase =
      isLoading && (messages.length === 0 || messages.at(-1)?.role === 'user');

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
            const isUser = message.role === 'user';
            const isError = (message.metadata as Record<string, unknown>)?.isError;
            // Hide action buttons on the actively streaming message
            const isLastAndStreaming = isLoading && message.id === lastMessageId;
            const hasPendingAction = pendingAction?.messageId === message.id;

            // Thinking pill state for this message
            const hasThinkingPill = !isUser && thinkingIds.has(message.id);
            const pillExpanded = expandedIds.has(message.id);
            const pillStreaming = isLoading && message.id === lastMessageId && hasThinkingPill;

            return (
               <div
                  key={message.id}
                  // `group` drives hover-based visibility of the action row
                  className={`group mb-2 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
               >
                  {/* Pill + bubble wrapped together so they share the same width */}
                  <div className={`flex flex-col ${isUser ? 'max-w-[75%]' : 'max-w-[85%]'}`}>
                     {hasThinkingPill && (
                        <div className="w-0 min-w-full">
                           <ThinkingPill
                              isStreaming={pillStreaming}
                              expanded={pillExpanded}
                              onToggle={() => togglePill(message.id)}
                           />
                        </div>
                     )}

                     {/* Bubble */}
                     <div
                        className={`w-full rounded-lg px-4 py-2 ${isUser
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
                              <ReactMarkdown
                                 remarkPlugins={REMARK_PLUGINS}
                                 components={MD_COMPONENTS}
                              >
                                 {getTextContent(message)}
                              </ReactMarkdown>
                           </div>
                        ) : (
                           <span className="text-sm whitespace-pre-wrap">{getTextContent(message)}</span>
                        )}
                     </div>
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
         {isThinkingPhase && <StandaloneThinkingBlock />}

         {/* Error bubble */}
         {error && !isLoading && (
            <div className="mb-2 flex justify-start">
               <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
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
               className="fixed bottom-28 sm:bottom-24 right-6 z-20 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all animate-fade-in"
            >
               <IconChevronDown size={16} />
            </button>
         )}
      </div>
   );
}
