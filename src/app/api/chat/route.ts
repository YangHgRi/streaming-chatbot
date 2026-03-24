import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
