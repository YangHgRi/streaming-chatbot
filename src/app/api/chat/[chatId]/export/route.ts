// Returns a Content-Disposition header that supports Unicode filenames (RFC 6266).
// The filename* parameter uses UTF-8 percent-encoding; the plain filename= is an
// ASCII-safe fallback for older clients.
function contentDisposition(title: string, ext: string): string {
   // ASCII fallback: keep alphanumerics, dots, hyphens; replace everything else with _
   const ascii = title
      .normalize('NFD')                    // decompose accents
      .replace(/[\u0300-\u036f]/g, '')    // strip combining marks
      .replace(/[^\w\-.\s]/g, '_')        // non-ASCII to _
      .replace(/\s+/g, '_')               // spaces to _
      .replace(/_+/g, '_')                // collapse repeated _
      .replace(/^_|_$/g, '')              // trim leading/trailing _
      || 'export';
   const encoded = encodeURIComponent(`${title}.${ext}`);
   return `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encoded}`;
}

import { getChat, getMessages } from '@/lib/db/queries';
import { ERROR_SENTINEL_PREFIX, ROLE_USER, ROLE_ASSISTANT } from '@/constants';

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
         m.role === ROLE_USER ||
         (m.role === ROLE_ASSISTANT && !m.content.startsWith(ERROR_SENTINEL_PREFIX)),
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
            'Content-Disposition': contentDisposition(chat.title, 'json'),
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
      lines.push(msg.role === ROLE_USER ? '**You:**' : '**Assistant:**');
      lines.push(msg.content, '');
   }
   const markdown = lines.join('\n');
   return new Response(markdown, {
      headers: {
         'Content-Type': 'text/markdown; charset=utf-8',
         'Content-Disposition': contentDisposition(chat.title, 'md'),
      },
   });
}
