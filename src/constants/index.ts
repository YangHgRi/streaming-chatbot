// Default title assigned to every new chat before the user sends a message
// or the auto-title LLM runs. Used as the INSERT default in the schema,
// the fallback value in queries, and the guard string in the title logic.
export const DEFAULT_CHAT_TITLE = 'New Chat';

// Prefix written at the start of assistant message content when the API call
// fails. Lets the chat page distinguish error rows from normal responses and
// expose the error text via metadata instead of rendering the raw prefix.
export const ERROR_SENTINEL_PREFIX = '__ERROR__:';
