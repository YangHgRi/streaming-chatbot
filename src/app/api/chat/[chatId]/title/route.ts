import { generateText } from 'ai';
import { revalidatePath } from 'next/cache';
import { createOpenAI } from '@ai-sdk/openai';
import { updateChat, getChat } from '@/lib/db/queries';

const openai = createOpenAI({
   baseURL: process.env.OPENAI_API_BASE_URL,
});

const MODEL_NAME = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

// Maximum characters of user input fed into the title-generation prompt.
const TITLE_INPUT_MAX_LEN = 500;

// Maximum character length for auto-generated chat titles.
const TITLE_MAX_LEN = 20;

async function generateChatTitle(firstUserText: string): Promise<string> {
   const prompt =
      `Summarize the following message into a chat title.\n` +
      `Rules:\n` +
      `- Maximum ${TITLE_MAX_LEN} characters (strictly enforced — count carefully)\n` +
      `- Match the language of the message\n` +
      `- No quotation marks, no punctuation at the end\n` +
      `- Output the title only, nothing else\n\n` +
      `Message: ${firstUserText.slice(0, TITLE_INPUT_MAX_LEN)}`;
   try {
      const { text } = await generateText({
         model: openai(MODEL_NAME),
         prompt,
         maxRetries: 1,
      });
      const candidate = text.trim().replace(/^["']|["']$/g, '');
      return candidate.length <= TITLE_MAX_LEN ? candidate : candidate.slice(0, TITLE_MAX_LEN);
   } catch (err) {
      console.warn('[title] Generation failed, falling back to truncation:', err);
      return firstUserText.length <= TITLE_MAX_LEN
         ? firstUserText
         : firstUserText.slice(0, TITLE_MAX_LEN);
   }
}

export async function POST(
   req: Request,
   { params }: { params: Promise<{ chatId: string }> },
) {
   const { chatId } = await params;

   const chat = await getChat(chatId);
   if (!chat) {
      return new Response('Chat not found', { status: 404 });
   }

   // Pull the first user message text from the request body.
   let firstUserText = '';
   try {
      const body = await req.json();
      if (typeof body?.firstUserMessage === 'string') {
         firstUserText = body.firstUserMessage.trim();
      }
   } catch {
      // No body is fine — we just won't be able to generate a meaningful title.
   }

   const title = firstUserText ? await generateChatTitle(firstUserText) : undefined;
   await updateChat(chatId, title ? { title, titled: true } : { titled: true });

   revalidatePath('/', 'layout');
   return new Response(null, { status: 204 });
}
