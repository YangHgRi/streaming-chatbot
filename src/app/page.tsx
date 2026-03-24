import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';

export default async function HomePage() {
  const allChats = await db.select().from(chats);

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Streaming Chatbot</h1>
      <p>DB connection: OK</p>
      <p>Chats in database: {allChats.length}</p>
      <pre style={{ fontSize: '0.8rem', color: '#888' }}>
        {JSON.stringify(allChats, null, 2)}
      </pre>
    </main>
  );
}
