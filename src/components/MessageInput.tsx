'use client';
import { useState, useRef, useEffect, useTransition } from 'react';
import type { ChatStatus } from 'ai';

export function MessageInput({
   onSend,
   onNewChat,
   onStop,
   status,
}: {
   onSend: (text: string) => void;
   onNewChat: () => Promise<void>;
   onStop: () => void;
   status: ChatStatus;
}) {
   const [input, setInput] = useState('');
   const isLoading = status === 'submitted' || status === 'streaming';
   const isStreaming = status === 'streaming';
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const [isCreating, startCreateTransition] = useTransition();

   // Auto-grow textarea height to fit content, capped at ~8 lines.
   useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
   }, [input]);

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
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2 items-end">
         {/* New Chat button — left of textarea */}
         <button
            type="button"
            disabled={isCreating}
            onClick={() => startCreateTransition(onNewChat)}
            title="New chat"
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
         >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <line x1="12" y1="5" x2="12" y2="19" />
               <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
         </button>
         <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitIfValid();
               }
            }}
            disabled={isLoading}
            placeholder="Type a message… (Shift+Enter for new line)"
            className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden"
            rows={1}
            style={{ maxHeight: '200px' }}
         />
         {/* Stop button — shown only while streaming */}
         {isStreaming ? (
            <button
               type="button"
               onClick={onStop}
               title="Stop generation"
               className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex-shrink-0 flex items-center gap-1.5 transition-colors"
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
               className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex-shrink-0"
            >
               Send
            </button>
         )}
      </form>
   );
}
