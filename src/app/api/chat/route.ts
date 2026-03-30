import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createMessage, updateChat, getChat } from '@/lib/db/queries';
import { ERROR_SENTINEL_PREFIX } from '@/constants';

// Validate OPENAI_API_KEY at module load for a clear error in dev
// instead of a cryptic 401 / SDK exception on the first request.
if (!process.env.OPENAI_API_KEY) {
   throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
      'Copy .env.local.example to .env.local and fill in the value.',
   );
}

// Optional base URL override — set OPENAI_API_BASE_URL in .env.local
// to point at a proxy, Azure OpenAI, or any OpenAI-compatible API.
const openai = createOpenAI({
   baseURL: process.env.OPENAI_API_BASE_URL,
});

// Resolve model name; set OPENAI_MODEL in .env.local to switch without touching code.
const MODEL_NAME = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';


export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
   // Parse body safely — malformed JSON returns 400 instead of 500
   let body: { id?: unknown; messages?: unknown };
   try {
      body = await req.json();
   } catch {
      return new Response('Invalid JSON body', { status: 400 });
   }

   const { id: chatId, messages } = body;

   // Validate chatId — required to associate messages with a conversation
   if (!chatId || typeof chatId !== 'string') {
      return new Response('Missing or invalid chatId', { status: 400 });
   }

   // Run cheap in-memory validations before any DB round-trip.
   if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Missing or invalid messages array', { status: 400 });
   }

   // Verify the chat exists before touching messages; an unknown chatId would
   // trigger a PostgreSQL FK violation (23503) that bubbles up as an unhandled 500.
   const chat = await getChat(chatId);
   if (!chat) {
      return new Response('Chat not found', { status: 404 });
   }

   // ── STEP 1: Persist user message BEFORE calling LLM ──────────────────────────
   // User message is saved exactly once, outside the retry loop.
   const lastMessage = messages.at(-1) as Record<string, unknown>;
   if (lastMessage.role === 'user') {
      // Use explicit type guard instead of inline cast
      const parts = Array.isArray(lastMessage.parts) ? lastMessage.parts : [];
      const content = parts
         .filter((p): p is { type: 'text'; text: string } => {
            // Verify BOTH type === 'text' AND that text is a string to avoid
            if (typeof p !== 'object' || p === null) return false;
            const r = p as Record<string, unknown>;
            return r.type === 'text' && typeof r.text === 'string';
         })
         .map((p) => p.text)
         .join('');

      // Skip insert when there is no text content — e.g. a message composed
      // entirely of non-text parts.
      if (!content) {
         return new Response('Empty message content', { status: 400 });
      }

      // Use the UIMessage's own stable id as the DB row id so that
      // onConflictDoNothing fires correctly on client retries.
      const msgId =
         typeof lastMessage.id === 'string' && lastMessage.id.length > 0
            ? lastMessage.id
            : (() => {
               // SDK should always assign a stable id; warn if missing so any
               console.warn('[chat] lastMessage.id missing — falling back to randomUUID(); retries may duplicate this message');
               return crypto.randomUUID();
            })();

      await createMessage({
         id: msgId,
         chatId,
         role: 'user',
         content,
      });
   }

   // ── STEP 2: Convert UIMessage[] to ModelMessage[] (required for AI SDK v6) ──
   const modelMessages = await convertToModelMessages(messages as UIMessage[]);

   // ── STEP 3: Stream with built-in retry ─────────────────────────────────────
   const result = streamText({
      model: openai(MODEL_NAME),
      messages: modelMessages,
      system: 'You are a helpful assistant.',
      maxRetries: 2,
      onError: async ({ error }) => {
         // Persist a sentinel error message so the error survives page reload.
         const msg = error instanceof Error ? error.message : 'Unknown error';
         try {
            await createMessage({
               id: crypto.randomUUID(),
               chatId,
               role: 'assistant',
               content: `${ERROR_SENTINEL_PREFIX}${msg}`,
            });
            // Touch updatedAt so the sidebar re-sorts this chat to the top.
            await updateChat(chatId, {});
         } catch (persistErr) {
            console.error('[chat] CRITICAL: Failed to persist error message:', { chatId, error: persistErr });
         }
      },
      onFinish: async ({ text }) => {
         // ── STEP 4: Persist assistant response after stream completes ───────────
         // onFinish fires exactly once. MUST be wrapped in try/catch — the HTTP
         // response is already sent (200 OK), so errors here cannot reach the client.
         try {
            await createMessage({
               id: crypto.randomUUID(),
               chatId,
               role: 'assistant',
               content: text,
            });
            // Touch updatedAt so the sidebar re-sorts this chat to the top.
            await updateChat(chatId, {});
         } catch (err) {
            // Silent DB failures are unacceptable — log explicitly
            console.error('[chat] CRITICAL: Failed to persist assistant message:', {
               chatId,
               textLength: text.length,
               error: err,
            });
            // Skip title trigger — the assistant message was not persisted.
            return;
         }
      },
   });

   // ── STEP 5: Return streaming response ────────────────────────────────────────
   return result.toUIMessageStreamResponse();
}
