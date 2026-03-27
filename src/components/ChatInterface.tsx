'use client';
import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatInterface({
   chatId,
   initialMessages,
}: {
   chatId: string;
   initialMessages: UIMessage[];
}) {
   // useChat.id sends chatId as 'id' field in every request body (AI SDK v6 behavior).
   // useChat.messages seeds the hook with DB-fetched history (replaces old initialMessages option).
   const { messages, sendMessage, status, error, stop } = useChat({
      id: chatId,
      messages: initialMessages,
   });

   // Derived boolean for convenience — status has 4 values: submitted|streaming|ready|error
   const isLoading = status === 'submitted' || status === 'streaming';

   // N4: Stabilise the stop reference with a ref so it never appears in the
   // useEffect dependency array. Without this, stop() is a new function object on
   // every render (SDK implementation detail), causing the cleanup effect to re-run
   // on every re-render and potentially aborting in-flight streams unexpectedly.
   const stopRef = useRef(stop);
   useEffect(() => {
      stopRef.current = stop;
   });

   // Stream leak prevention (CONV-03):
   // Abort the in-flight fetch when the user navigates away (chatId changes) or the
   // component unmounts. Using stopRef.current avoids stale-closure issues and keeps
   // chatId as the sole trigger — this effect runs only when the conversation switches.
   useEffect(() => {
      return () => {
         stopRef.current();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- stop is intentionally
      // excluded; its latest value is always accessible via stopRef
   }, [chatId]);

   return (
      <div className="flex flex-col h-full">
         <MessageList messages={messages} isLoading={isLoading} error={error} />
         <MessageInput
            onSend={(text) => sendMessage({ text })}
            status={status}
         />
      </div>
   );
}
