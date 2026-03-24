import { redirect } from 'next/navigation';
import { createChat } from '@/lib/db/queries';

async function startChat() {
  'use server';
  const chat = await createChat();
  redirect(`/chat/${chat.id}`);
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Streaming Chat</h1>
          <p className="text-gray-500">Start a conversation with the AI assistant</p>
        </div>
        <form action={startChat}>
          <button
            type="submit"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start New Chat
          </button>
        </form>
      </div>
    </main>
  );
}
