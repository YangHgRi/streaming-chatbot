import { getChatByShareId, getMessages } from '@/lib/db/queries';
import { notFound } from 'next/navigation';
import { ERROR_SENTINEL_PREFIX, ROLE_USER, ROLE_ASSISTANT } from '@/constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const chat = await getChatByShareId(shareId);
  if (!chat) notFound();

  const dbMessages = await getMessages(chat.id);
  const messages = dbMessages.filter(
    (m) => (m.role === ROLE_USER || m.role === ROLE_ASSISTANT) && !m.content.startsWith(ERROR_SENTINEL_PREFIX)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{chat.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Shared conversation</p>
        </div>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === ROLE_USER ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === ROLE_USER
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}>
                {msg.role === ROLE_ASSISTANT ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-sm whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-gray-400">No messages in this conversation.</p>
          )}
        </div>
      </div>
    </div>
  );
}
