'use client';
import { useState, useRef, useTransition } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import type { ChatStatus } from 'ai';

export function MessageInput({
   onSend,
   onNewChat,
   onStop,
   status,
   onArrowUp,
}: {
   onSend: (text: string) => void;
   onNewChat: () => Promise<void>;
   onStop: () => void;
   status: ChatStatus;
   onArrowUp?: () => void;
}) {
   const [input, setInput] = useState('');
   const isLoading = status === 'submitted' || status === 'streaming';
   const isStreaming = status === 'streaming';
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const [isCreating, startCreateTransition] = useTransition();

   // rerender-move-effect-to-event: resize is synchronous DOM work triggered by
   // user input — do it directly in onChange to avoid an extra render cycle.

   // Shared submit logic for both onSubmit and onKeyDown handlers.
   function submitIfValid() {
      if (!input.trim() || isLoading) return;
      onSend(input.trim());
      setInput('');
      // Reset height after clearing the input
      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto';
      }
      // Return focus so keyboard users can type the next message immediately
      textareaRef.current?.focus();
   }

   function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      submitIfValid();
   }

   return (
      <form onSubmit={handleSubmit} className="h-12 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 flex gap-2 items-center flex-shrink-0">
         {/* New Chat button — left of textarea */}
         <button
            type="button"
            disabled={isCreating}
            onClick={() => startCreateTransition(onNewChat)}
            title="New chat"
            className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
         >
            <MessageSquarePlus size={20} />
         </button>
         <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
               setInput(e.target.value);
               // Auto-grow textarea height to fit content, capped at ~8 lines.
               const el = e.currentTarget;
               el.style.height = 'auto';
               el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitIfValid();
               }
               if (e.key === 'ArrowUp' && !input.trim()) {
                  e.preventDefault();
                  onArrowUp?.();
               }
            }}
            disabled={isLoading}
            placeholder="Type a message… (Shift+Enter for new line)"
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 py-1.5 px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden"
            rows={1}
            style={{ maxHeight: '200px' }}
         />
         {/* Stop button — shown only while streaming */}
         {isStreaming ? (
            <button
               type="button"
               onClick={onStop}
               title="Stop generation"
               className="px-4 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0 flex items-center gap-1.5 transition-colors"
            >
               {/* Square stop icon */}
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
               </svg>
               Stop
            </button>
         ) : (
            <button
               type="submit"
               disabled={isLoading}
               className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex-shrink-0"
            >
               Send
            </button>
         )}
      </form>
   );
}
