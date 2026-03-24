---
id: 02-03-chat-components
phase: 2
wave: 2
depends_on: [02-01-db-query-layer]
files_modified:
  - src/components/ChatInterface.tsx
  - src/components/MessageList.tsx
  - src/components/MessageInput.tsx
autonomous: true
requirements: [MSG-01, MSG-02, MSG-03, MSG-04, MSG-05]
---

# Plan 03: Chat UI Components

## Objective

Create three React client components in `src/components/`:
- `ChatInterface.tsx` — owns `useChat` hook, orchestrates the chat view
- `MessageList.tsx` — renders message bubbles with streaming-aware loading indicator and inline error bubble
- `MessageInput.tsx` — textarea + submit button, disabled while streaming

Design decisions from CONTEXT.md:
- D-01: ChatGPT-style aligned bubbles — user messages right-aligned (gray bg), assistant left-aligned (white bg)
- D-02: Tailwind utility classes only
- D-03: Pulsing dots in the message thread while assistant is responding (not a spinner outside thread)
- D-04: Inline error bubble inside thread where the response would have been
- D-05: Input disabled while `isLoading` (status === 'submitted' || status === 'streaming')

API note: Uses AI SDK v6 (`@ai-sdk/react@3.0.139`). `useChat` returns `status` (not `isLoading`), `sendMessage` (not `handleSubmit`/`handleInputChange`). The hook option is `messages` (not `initialMessages`) for seeding from DB.

<tasks>

<task id="T01" title="Create src/components/ChatInterface.tsx">
  <read_first>
  - `src/lib/db/schema.ts` — `Chat`, `Message` types (to understand data shape flowing in)
  - `.planning/phases/02-core-loop/02-RESEARCH.md` — §6.1 ChatInterface pattern, §2.3 chatId flow via useChat id option
  </read_first>

  <action>
  Create `src/components/ChatInterface.tsx`:

  ```tsx
  'use client';
  import { useChat } from '@ai-sdk/react';
  import type { UIMessage } from 'ai';
  import { MessageList } from './MessageList';
  import { MessageInput } from './MessageInput';

  export function ChatInterface({
    chatId,
    initialMessages,
  }: {
    chatId: string;
    initialMessages: UIMessage[];
  }) {
    // useChat.id sends chatId as 'id' field in every request body (AI SDK v6 behavior).
    // useChat.messages seeds the hook with DB-fetched history (replaces old initialMessages option).
    const { messages, sendMessage, status, error } = useChat({
      id: chatId,
      messages: initialMessages,
    });

    // Derived boolean for convenience — status has 4 values: submitted|streaming|ready|error
    const isLoading = status === 'submitted' || status === 'streaming';

    return (
      <div className="flex flex-col h-full">
        <MessageList messages={messages} isLoading={isLoading} error={error} />
        <MessageInput
          onSend={(text) => sendMessage({ text })}
          status={status}
        />
      </div>
    );
  }
  ```

  Notes:
  - `'use client'` directive is mandatory — `useChat` uses browser APIs
  - `id: chatId` is the mechanism by which the SDK sends `chatId` as `id` in POST body
  - `messages: initialMessages` seeds hook with DB history for multi-turn (MSG-03)
  - `sendMessage({ text })` is the AI SDK v6 API — `handleSubmit`/`append` do not exist
  </action>

  <acceptance_criteria>
  - `src/components/ChatInterface.tsx` exists
  - `src/components/ChatInterface.tsx` contains `'use client'`
  - `src/components/ChatInterface.tsx` contains `import { useChat } from '@ai-sdk/react'`
  - `src/components/ChatInterface.tsx` contains `import type { UIMessage } from 'ai'`
  - `src/components/ChatInterface.tsx` contains `id: chatId,`
  - `src/components/ChatInterface.tsx` contains `messages: initialMessages,`
  - `src/components/ChatInterface.tsx` contains `const { messages, sendMessage, status, error } = useChat(`
  - `src/components/ChatInterface.tsx` contains `const isLoading = status === 'submitted' || status === 'streaming'`
  - `src/components/ChatInterface.tsx` contains `sendMessage({ text })`
  - `src/components/ChatInterface.tsx` does NOT contain `isLoading` as a useChat return value (it must be derived)
  - `src/components/ChatInterface.tsx` does NOT contain `handleSubmit`
  - `src/components/ChatInterface.tsx` does NOT contain `initialMessages` as a useChat option key (must use `messages`)
  </acceptance_criteria>
</task>

<task id="T02" title="Create src/components/MessageList.tsx">
  <read_first>
  - `src/components/ChatInterface.tsx` — props shape passed to MessageList (messages, isLoading, error)
  - `.planning/phases/02-core-loop/02-RESEARCH.md` — §6.2 MessageList pattern, decisions D-01, D-03, D-04
  - `.planning/phases/02-core-loop/02-CONTEXT.md` — D-01 (bubble alignment), D-03 (pulsing dots in thread), D-04 (inline error bubble)
  </read_first>

  <action>
  Create `src/components/MessageList.tsx`:

  ```tsx
  'use client';
  import type { UIMessage } from 'ai';

  function getTextContent(message: UIMessage): string {
    return message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('') ?? '';
  }

  export function MessageList({
    messages,
    isLoading,
    error,
  }: {
    messages: UIMessage[];
    isLoading: boolean;
    error?: Error;
  }) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              {getTextContent(message)}
            </div>
          </div>
        ))}

        {/* MSG-04: Pulsing dots loading indicator as a message bubble in the thread (D-03) */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* MSG-05: Inline error bubble where the response would have been (D-04) */}
        {error && !isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error.message || 'Something went wrong. Please try again.'}
            </div>
          </div>
        )}
      </div>
    );
  }
  ```

  Notes:
  - `getTextContent` extracts text from `UIMessage.parts` array (AI SDK v6 message format)
  - User messages: `justify-end` + `bg-gray-200` (right-aligned gray, D-01)
  - Assistant messages: `justify-start` + `bg-white border` (left-aligned white, D-01)
  - Loading dots appear as a message bubble at the bottom of the thread (D-03)
  - Error bubble appears only when `error` is set AND not currently loading (D-04)
  </action>

  <acceptance_criteria>
  - `src/components/MessageList.tsx` exists
  - `src/components/MessageList.tsx` contains `'use client'`
  - `src/components/MessageList.tsx` contains `import type { UIMessage } from 'ai'`
  - `src/components/MessageList.tsx` contains `justify-end`
  - `src/components/MessageList.tsx` contains `justify-start`
  - `src/components/MessageList.tsx` contains `animate-bounce`
  - `src/components/MessageList.tsx` contains `isLoading && (`
  - `src/components/MessageList.tsx` contains `error && !isLoading`
  - `src/components/MessageList.tsx` contains `bg-red-50`
  - `src/components/MessageList.tsx` contains `error.message || 'Something went wrong`
  - `src/components/MessageList.tsx` contains `getTextContent`
  - `src/components/MessageList.tsx` contains `p.type === 'text'`
  </acceptance_criteria>
</task>

<task id="T03" title="Create src/components/MessageInput.tsx">
  <read_first>
  - `src/components/ChatInterface.tsx` — how onSend and status are passed to MessageInput
  - `.planning/phases/02-core-loop/02-RESEARCH.md` — §6.3 MessageInput pattern, §2.4 sendMessage API
  - `.planning/phases/02-core-loop/02-CONTEXT.md` — D-05 (input disabled while isLoading)
  </read_first>

  <action>
  Create `src/components/MessageInput.tsx`:

  ```tsx
  'use client';
  import { useState } from 'react';
  import type { ChatStatus } from 'ai';

  export function MessageInput({
    onSend,
    status,
  }: {
    onSend: (text: string) => void;
    status: ChatStatus;
  }) {
    const [input, setInput] = useState('');
    const isLoading = status === 'submitted' || status === 'streaming';

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      onSend(input.trim());
      setInput('');
    }

    return (
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          disabled={isLoading}
          placeholder="Type a message..."
          className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          Send
        </button>
      </form>
    );
  }
  ```

  Notes:
  - `ChatStatus` type imported from `'ai'` — values: `'submitted' | 'streaming' | 'ready' | 'error'`
  - Component manages its own `input` state with `useState` — hook no longer provides this
  - `disabled={isLoading}` on both textarea and button (D-05)
  - Enter key submits, Shift+Enter inserts newline
  - `onSend` callback is called with trimmed text; input is cleared after send
  - Input clears immediately on submit (optimistic UX — matches ChatGPT behavior)
  </action>

  <acceptance_criteria>
  - `src/components/MessageInput.tsx` exists
  - `src/components/MessageInput.tsx` contains `'use client'`
  - `src/components/MessageInput.tsx` contains `import type { ChatStatus } from 'ai'`
  - `src/components/MessageInput.tsx` contains `status: ChatStatus`
  - `src/components/MessageInput.tsx` contains `const [input, setInput] = useState('')`
  - `src/components/MessageInput.tsx` contains `disabled={isLoading}`
  - `src/components/MessageInput.tsx` contains `onSend(input.trim())`
  - `src/components/MessageInput.tsx` contains `setInput('')`
  - `src/components/MessageInput.tsx` contains `e.key === 'Enter' && !e.shiftKey`
  - `src/components/MessageInput.tsx` does NOT contain `handleInputChange`
  - `src/components/MessageInput.tsx` does NOT contain `isLoading` as an import (must be derived from status)
  </acceptance_criteria>
</task>

</tasks>

<verification>
TypeScript check for all three components:
```bash
npx tsc --noEmit
```
Expected: No errors in any component file.

Verify component exports:
```bash
grep "^export function" src/components/ChatInterface.tsx src/components/MessageList.tsx src/components/MessageInput.tsx
```
Expected:
```
src/components/ChatInterface.tsx:export function ChatInterface(
src/components/MessageList.tsx:export function MessageList(
src/components/MessageInput.tsx:export function MessageInput(
```

Verify no forbidden API usage:
```bash
grep -rn "handleSubmit\|handleInputChange\|isLoading\|initialMessages\|toDataStreamResponse" src/components/
```
Expected: No matches.
</verification>

<must_haves>
- All three components use `'use client'` directive
- `ChatInterface` passes `id: chatId` and `messages: initialMessages` to `useChat` (not `initialMessages` as the option key)
- Loading indicator (pulsing dots) appears INSIDE the message thread, not outside it (D-03)
- Error bubble appears inside the message thread (D-04)
- `MessageInput` textarea and submit button are BOTH disabled when `status === 'submitted' || status === 'streaming'`
- No usage of `handleSubmit`, `handleInputChange`, `isLoading` from `useChat`, or `toDataStreamResponse`
- TypeScript compiles without errors
</must_haves>
