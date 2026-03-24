'use client';
import { useState } from 'react';
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
          }
        }}
        disabled={isLoading}
        placeholder="Type a message..."
        className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={1}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
      >
        Send
      </button>
    </form>
  );
}
