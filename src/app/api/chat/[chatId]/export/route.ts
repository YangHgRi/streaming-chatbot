import { getChat, getMessages } from '@/lib/db/queries';
import { ERROR_SENTINEL_PREFIX } from '@/constants';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const format = new URL(req.url).searchParams.get('format') ?? 'markdown';

  const [chat, messages] = await Promise.all([
    getChat(chatId),
    getMessages(chatId),
  ]);
  if (!chat) return new Response('Not found', { status: 404 });

  const visibleMessages = messages.filter(
    (m) =>
      m.role === 'user' ||
      (m.role === 'assistant' && !m.content.startsWith(ERROR_SENTINEL_PREFIX)),
  );

  if (format === 'json') {
    const data = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      messages: visibleMessages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${chat.title.replace(/[^a-z0-9]/gi, '_')}.json"`,
      },
    });
  }

  // Markdown format (default)
  const lines: string[] = [
    `# ${chat.title}`,
    '',
    `*Exported on ${new Date().toLocaleDateString()}*`,
    '',
  ];
  for (const msg of visibleMessages) {
    lines.push(msg.role === 'user' ? '**You:**' : '**Assistant:**');
    lines.push(msg.content, '');
  }
  const markdown = lines.join('\n');
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${chat.title.replace(/[^a-z0-9]/gi, '_')}.md"`,
    },
  });
}
