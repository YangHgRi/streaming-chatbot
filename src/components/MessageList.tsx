'use client';
import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// U4: UIMessage.parts is non-optional in AI SDK v6 (always UIMessagePart[]).
// Removed the unnecessary ?. optional chain and ?? '' dead-code fallback.
// Added a proper type predicate so the inline cast inside .map() is also gone.
function getTextContent(message: UIMessage): string {
   return message.parts
      .filter((p): p is { type: 'text'; text: string } => {
         // W7: mirror the W2 fix from route.ts — verify BOTH type === 'text' AND
         // that text is actually a string. A predicate that only checks `type`
         // is type-unsound: { type:'text', text: undefined } would pass the filter,
         // be typed as string by TypeScript, then joined as the literal "undefined".
         if (typeof p !== 'object' || p === null) return false;
         const r = p as Record<string, unknown>;
         return r.type === 'text' && typeof r.text === 'string';
      })
      .map((p) => p.text)
      .join('');
}

export function MessageList({
   messages,
   isLoading,
   error,
}: {
   messages: UIMessage[];
   isLoading: boolean;
   error?: Error;
}) {
   // Issue #5: auto-scroll to the latest message whenever messages change or
   // while streaming (isLoading changes on every token in practice via re-render)
   const bottomRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      // T4: use 'instant' instead of 'smooth' — during streaming, messages array
      // gets a new reference on every token, triggering a new smooth animation that
      // cancels the previous one and causes visible jank. 'instant' completes atomically.
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
   }, [messages, isLoading]);

   return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
         {messages.map((message) => (
            <div
               key={message.id}
               className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
               <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === 'user'
                     ? 'bg-gray-200 text-gray-900'
                     : 'bg-white border border-gray-200 text-gray-900'
                     }`}
               >
                  {message.role === 'assistant' ? (
                     // Issue #6: render Markdown for assistant messages
                     <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                           {getTextContent(message)}
                        </ReactMarkdown>
                     </div>
                  ) : (
                     // User messages are plain text (user input, not LLM output)
                     <span className="text-sm whitespace-pre-wrap">{getTextContent(message)}</span>
                  )}
               </div>
            </div>
         ))}

         {/* MSG-04: Pulsing dots loading indicator as a message bubble in the thread (D-03) */}
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

         {/* MSG-05: Inline error bubble where the response would have been (D-04) */}
         {error && !isLoading && (
            <div className="flex justify-start">
               <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
                  {/* W8: never expose raw error.message to users — it contains technical
                      strings like "fetch failed", "401 Unauthorized", "429 Too Many Requests".
                      A fixed friendly string is safe; callers who need detail can console.error. */}
                  Something went wrong. Please try again.
               </div>
            </div>
         )}

         {/* Scroll anchor — always kept at the bottom of the message list */}
         <div ref={bottomRef} />
      </div>
   );
}
