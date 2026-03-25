'use client';
import { useChat } from '@ai-sdk/react';
import { useEffect } from 'react';
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

  // Stream leak prevention (CONV-03 / Phase 3 gate criterion #5):
  // When the user navigates to a different conversation while an assistant response is
  // mid-stream, Next.js unmounts this ChatInterface and mounts a new one with the new chatId.
  // The cleanup function fires before unmount, aborting the in-flight fetch via AbortController.
  // stop() returns Promise<void> — called without await (fire-and-forget) because
  // React cleanup functions must be synchronous.
  useEffect(() => {
    return () => {
      stop();
    };
  }, [chatId, stop]);

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
