'use client';
import { useState, useRef, useEffect } from 'react';
import type { ChatStatus } from 'ai';

export function MessageInput({
   onSend,
   status,
}: {
   onSend: (text: string) => void;
   status: ChatStatus;
}) {
   const [input, setInput] = useState('');
   const isLoading = status === 'submitted' || status === 'streaming';
   const textareaRef = useRef<HTMLTextAreaElement>(null);

   // Issue #11: auto-grow textarea height to fit content, capped at ~8 lines
   useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
   }, [input]);

   // T5: extract submitIfValid() so both the form's onSubmit handler and the
   // onKeyDown handler share the same code path without needing an unsafe
   // cross-type cast (KeyboardEvent → FormEvent). Each caller is responsible
   // for calling e.preventDefault() before invoking this helper.
   function submitIfValid() {
      if (!input.trim() || isLoading) return;
      onSend(input.trim());
      setInput('');
      // Reset height after clearing the input
      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto';
      }
   }

   function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      submitIfValid();
   }

   return (
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2 items-end">
         <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // T5: call submitIfValid() directly — no unsafe cast needed
                  submitIfValid();
               }
            }}
            disabled={isLoading}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto"
            rows={1}
            style={{ maxHeight: '200px' }}
         />
         <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex-shrink-0"
         >
            Send
         </button>
      </form>
   );
}
