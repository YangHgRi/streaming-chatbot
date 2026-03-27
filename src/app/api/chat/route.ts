import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createMessage, updateChat, getChat } from '@/lib/db/queries';

// W4: validate OPENAI_API_KEY at module load — gives a clear error message in dev
// instead of a cryptic 401 / SDK exception on the first request.
// Mirrors the DATABASE_URL guard in src/lib/db/index.ts.
if (!process.env.OPENAI_API_KEY) {
   throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
      'Copy .env.local.example to .env.local and fill in the value.',
   );
}

// Instantiate provider with optional base URL override.
// Set OPENAI_API_BASE_URL in .env.local to point at a custom endpoint
// (e.g. a proxy, Azure OpenAI, or any OpenAI-compatible API).
// Falls back to the official OpenAI API when the variable is unset.
const openai = createOpenAI({
   baseURL: process.env.OPENAI_API_BASE_URL,
});

// Resolve model name from environment variable, defaulting to 'gpt-4o-mini'.
// Set OPENAI_MODEL in .env.local to switch models without touching code.
const MODEL_NAME = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
   // Issue #3: parse body safely — malformed JSON returns 400 instead of 500
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

   // W6: run cheap in-memory validations before any DB round-trip.
   // A malformed request should be rejected without touching the database.
   if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Missing or invalid messages array', { status: 400 });
   }

   // V2: verify the chat exists in the DB before touching messages.
   // Without this, an unknown chatId triggers a PostgreSQL FK violation (23503)
   // which bubbles up as an unhandled 500. The ChatPage SSR guard does not
   // protect this API route — it must defend itself.
   const chat = await getChat(chatId);
   if (!chat) {
      return new Response('Chat not found', { status: 404 });
   }

   // ── STEP 1: Persist user message BEFORE calling LLM ──────────────────────────
   // (PERS-02, RELY-02 — user message saved exactly once, outside retry loop)
   // The last message in the array is always the new user message for trigger=submit-message
   // W10: messages.length > 0 is already guaranteed by the check above (line 43),
   // so at(-1) cannot return undefined here. Drop '| undefined' from the cast
   // and replace the downstream optional-chain with a direct property access.
   const lastMessage = messages.at(-1) as Record<string, unknown>;
   if (lastMessage.role === 'user') {
      // Issue #7: use explicit type guard instead of inline cast
      const parts = Array.isArray(lastMessage.parts) ? lastMessage.parts : [];
      const content = parts
         .filter((p): p is { type: 'text'; text: string } => {
            // W2: the predicate must verify BOTH type === 'text' AND that text is a
            // string. Checking only `type` lets through { type:'text', text: undefined }
            // which TypeScript treats as string but joins as the literal "undefined".
            if (typeof p !== 'object' || p === null) return false;
            const r = p as Record<string, unknown>;
            return r.type === 'text' && typeof r.text === 'string';
         })
         .map((p) => p.text)
         .join('');

      // T3: server-side guard — skip insert when there is no text content
      // (e.g. a message composed entirely of non-text parts). The client
      // already prevents empty sends, but we must not trust client input.
      if (!content) {
         return new Response('Empty message content', { status: 400 });
      }

      // T1: use the UIMessage's own stable id as the DB row id.
      // crypto.randomUUID() produced a new id on every request, so
      // onConflictDoNothing() never fired on retry — the same user message
      // was inserted repeatedly. lastMessage.id is assigned by the SDK and
      // remains constant across client retries.
      const msgId =
         typeof lastMessage.id === 'string' && lastMessage.id.length > 0
            ? lastMessage.id
            : (() => {
               // V1: SDK should always assign a stable id; if it is missing
               // the onConflictDoNothing idempotency guarantee breaks and the
               // same user message may be inserted on every client retry.
               // Log a warning so any regression surfaces in server logs.
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

   // ── STEP 2: Convert UIMessage[] to ModelMessage[] (REQUIRED for ai@6) ────────
   // convertToModelMessages is async — must await. Passing UIMessage[] directly to
   // streamText causes TypeScript errors and runtime failures.
   // U1: messages passed Array.isArray narrowing → unknown[], not UIMessage[].
   // Explicit cast is safe here: the SDK-assigned structure is validated above
   // (non-empty array, role/parts checked for lastMessage). Casting lets TypeScript
   // catch future signature changes at the call site.
   const modelMessages = await convertToModelMessages(messages as UIMessage[]);

   // ── STEP 3: Stream with built-in retry (RELY-01) ──────────────────────────────
   // SDK default: maxRetries=2, exponential backoff, retries on 429/5xx/timeout only.
   // User message save above is NOT in the retry path — no duplication risk (RELY-02).
   const result = streamText({
      model: openai(MODEL_NAME),
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

            // Issue #2: update updatedAt so getChats() sorts this chat to the top
            await updateChat(chatId, {});
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
