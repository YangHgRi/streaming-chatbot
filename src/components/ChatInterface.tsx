'use client';
import { useChat } from '@ai-sdk/react';
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
  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
  });

  // Derived boolean for convenience — status has 4 values: submitted|streaming|ready|error
  const isLoading = status === 'submitted' || status === 'streaming';

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
