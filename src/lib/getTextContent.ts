import type { UIMessage } from 'ai';

/**
 * Extract plain text from a UIMessage by concatenating all text parts.
 * Validates both `type === 'text'` and `typeof text === 'string'` so that
 * malformed parts (e.g. { type:'text', text: undefined }) are safely excluded.
 */
export function getTextContent(message: UIMessage): string {
   return message.parts
      .filter((p): p is { type: 'text'; text: string } => {
         if (typeof p !== 'object' || p === null) return false;
         const r = p as Record<string, unknown>;
         return r.type === 'text' && typeof r.text === 'string';
      })
      .map((p) => p.text)
      .join('');
}
