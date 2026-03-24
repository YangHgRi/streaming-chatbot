'use client';
import type { UIMessage } from 'ai';

function getTextContent(message: UIMessage): string {
  return message.parts
    ?.filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('') ?? '';
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
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === 'user'
                ? 'bg-gray-200 text-gray-900'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}
          >
            {getTextContent(message)}
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
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        </div>
      )}
    </div>
  );
}
