import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createMessage } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { id: chatId, messages } = await req.json();

  // Validate chatId — required to associate messages with a conversation
  if (!chatId || typeof chatId !== 'string') {
    return new Response('Missing chatId', { status: 400 });
  }

  // ── STEP 1: Persist user message BEFORE calling LLM ──────────────────────────
  // (PERS-02, RELY-02 — user message saved exactly once, outside retry loop)
  // The last message in the array is always the new user message for trigger=submit-message
  const lastMessage = messages.at(-1);
  if (lastMessage?.role === 'user') {
    await createMessage({
      id: crypto.randomUUID(),
      chatId,
      role: 'user',
      content: lastMessage.parts
        ?.filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text: string }) => p.text)
        .join('') ?? '',
    });
  }

  // ── STEP 2: Convert UIMessage[] to ModelMessage[] (REQUIRED for ai@6) ────────
  // convertToModelMessages is async — must await. Passing UIMessage[] directly to
  // streamText causes TypeScript errors and runtime failures.
  const modelMessages = await convertToModelMessages(messages);

  // ── STEP 3: Stream with built-in retry (RELY-01) ──────────────────────────────
  // SDK default: maxRetries=2, exponential backoff, retries on 429/5xx/timeout only.
  // User message save above is NOT in the retry path — no duplication risk (RELY-02).
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: modelMessages,
    system: 'You are a helpful assistant.',
    maxRetries: 2,
    onFinish: async ({ text }) => {
      // ── STEP 4: Persist assistant response after stream completes (PERS-03) ───
      // onFinish fires exactly once per successful stream.
      // MUST be wrapped in try/catch — HTTP response already sent (200 OK),
      // so errors here cannot propagate to the client (Failure Mode 3).
      try {
        await createMessage({
          id: crypto.randomUUID(),
          chatId,
          role: 'assistant',
          content: text,
        });
      } catch (err) {
        // Silent DB failures are unacceptable — log explicitly
        console.error('[chat] CRITICAL: Failed to persist assistant message:', {
          chatId,
          textLength: text.length,
          error: err,
        });
      }
    },
  });

  // ── STEP 5: Return streaming response ────────────────────────────────────────
  // toUIMessageStreamResponse() returns a Response backed by a ReadableStream.
  // Do NOT await result.text before returning — that causes a hang (Failure Mode 1).
  // export const dynamic = 'force-dynamic' prevents Next.js from buffering (Failure Mode 5).
  return result.toUIMessageStreamResponse();
}
