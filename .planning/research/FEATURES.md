# Feature Research

**Domain:** Streaming Chatbot (ChatGPT-style UI)
**Researched:** 2025-07-14
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Streaming output | ChatGPT set the baseline — waiting for full response feels broken in 2024+ | LOW | **useChat handles this automatically** via SSE/ReadableStream; `streamText` + `toDataStreamResponse()` on the server side is the entire implementation |
| Send / receive messages | Core chat loop — without this there is no product | LOW | **useChat handles this automatically** — `handleSubmit`, `input`, `handleInputChange` all provided |
| Multi-turn context | Without prior messages the LLM has no memory; users expect follow-up questions to work | LOW | **useChat handles this automatically** — `messages` array is sent with every request; no custom code needed client-side |
| In-session message history | User scrolls up and sees the current conversation | LOW | **useChat handles this automatically** — `messages` state managed by the hook |
| Cross-session message persistence | User closes tab, reopens, history is still there | MEDIUM | **NOT handled by useChat** — requires custom DB writes; see hidden complexity note below |
| Conversation list (sidebar) | Users need to navigate between past conversations | MEDIUM | **Custom code required** — DB query for all chats, sidebar component, routing per chat ID |
| New chat creation | Start fresh without losing old conversations | LOW | **Custom code required** — generate a new chat ID, insert a row, redirect to new chat route |
| Loading / thinking indicator | Users need to know the app is working between submit and first token | LOW | **useChat provides `isLoading` boolean** — just wire it to a spinner or pulsing cursor |
| Error states | Network failure, API timeout, rate limit — app must not silently die | LOW | **useChat provides `error` state** — custom code to display it meaningfully |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required to ship, but elevate the demo.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Markdown rendering | LLMs output markdown constantly — bold, lists, headers look broken as raw text | LOW | `react-markdown` + `remark-gfm`; needs `components` prop to override default elements for styled output; ~30 lines of code |
| Code syntax highlighting | Code blocks are a primary LLM output — unformatted code is a UX fail for dev demos | LOW-MEDIUM | Pair `react-markdown` with `react-syntax-highlighter` or `prism-react-renderer`; requires custom `code` component renderer; streaming flicker can occur — see complexity note |
| Regenerate response | Users want to retry a bad answer without retyping; signals product polish | MEDIUM | Requires stripping the last assistant message, re-submitting; useChat's `reload()` function covers the basic case but stateful DB sync needs care |
| Copy message button | Convenience for taking LLM output elsewhere; very expected in dev tools | LOW | Clipboard API, conditional UI on hover; ~15 lines; no backend needed |
| Conversation rename | Auto-generated "Chat #1" titles are poor UX; rename = ownership | LOW-MEDIUM | PATCH endpoint + inline-edit UI; first-message auto-title (substring or LLM-generated) is a nice add-on but costs a second LLM call |
| Auto-title from first message | Conversations labeled with context vs "New Chat" — big UX win for sidebar | MEDIUM | Requires either substring truncation (trivial) or a second `generateText` call after first user message (one extra API call, one extra DB write) |
| Stop generation | User can cancel a running stream mid-response | LOW | **useChat provides `stop()`** — wire to a button that appears while `isLoading` is true; no backend needed |
| Model switcher | Swap GPT-4o-mini / GPT-4o per conversation | MEDIUM | Pass model param in request body via `useChat`'s `body` option; server reads it and passes to `streamText`; requires UI selector; per-chat persistence needs a DB column |
| Scroll-to-bottom | Auto-scroll during streaming; jump-to-bottom button when user scrolls up | LOW-MEDIUM | `useEffect` + `ref` on message list; detecting user scroll-up to suppress auto-scroll adds ~20 lines of logic |
| Keyboard shortcuts | `Cmd+Enter` to submit, `Esc` to cancel — power-user feel | LOW | Event listeners on textarea; no backend changes |

### Anti-Features (Explicitly NOT Building for 1-Week Demo)

Features that seem good but add cost without validating the core value.

| Feature | Why Requested | Why Problematic for This Scope | Alternative |
|---------|---------------|-------------------------------|-------------|
| Authentication / user accounts | "What if others access my chats?" | Multi-user changes schema, adds session logic, blocks all other work; violates single-user constraint | Single-user open access — documented in PROJECT.md as a constraint |
| File / image uploads | "Attach a PDF or screenshot" | Multipart form handling, file storage (S3 or local), vision model plumbing; OpenAI file API has its own latency and cost profile | Text-only for demo; placeholder UI can note "coming soon" |
| Voice input / output | "Talk to it like Siri" | Web Speech API cross-browser inconsistency, audio streaming adds a separate pipeline entirely separate from text streaming | Text input/output only for 1-week scope |
| Plugins / tool use | "Have it search the web" | Tool orchestration loops, error handling per tool, UI for tool calls — each tool is a mini-feature; multiplies test surface area | Focus on core conversation quality; tool framework (useChat supports it) can be layered in later |
| Real-time multi-tab sync | "Same chat open in two tabs" | Requires WebSockets or polling; conflicts with SSE streaming model; Out of Scope in PROJECT.md | Single-session assumption; acceptable for demo |
| Message editing | "Let me fix my prompt" | Re-submission from arbitrary history position invalidates all subsequent messages; complex DB branching | Regenerate covers the "redo" case without branching complexity |
| Conversation branching / forking | "Try this different answer path" | Non-linear history breaks the flat message array model that all LLM APIs assume | Linear conversation only; regenerate handles simple retry |
| Export / share conversations | "Send this to a colleague" | Share links require routing, access control decisions, or export formats (PDF, JSON) — each is a day of work | Copy-paste or copy-message button covers the immediate need |
| Prompt templates / system prompt editor | "Save my custom instructions" | Per-conversation system prompts + UI editor + persistence = medium feature on its own | Hard-code a sensible system prompt; easy to expose later |

## Feature Dependencies

```
[Cross-session Persistence]
    └──requires──> [DB Schema: chats + messages tables]
                       └──requires──> [Drizzle ORM setup + DATABASE_URL]

[Conversation List / Sidebar]
    └──requires──> [Cross-session Persistence]
    └──requires──> [Routing: /chat/[id] dynamic route]

[New Chat Creation]
    └──requires──> [Cross-session Persistence]
    └──requires──> [Routing: /chat/[id] dynamic route]

[Load Existing Chat]
    └──requires──> [Cross-session Persistence]
    └──requires──> [useChat `initialMessages` prop]

[Regenerate Response]
    └──requires──> [Cross-session Persistence] (must sync DB after reload)
    └──uses──> [useChat `reload()` built-in]

[Auto-title from First Message]
    └──requires──> [Cross-session Persistence]
    └──requires──> [New Chat Creation]
    └──enhances──> [Conversation List]

[Code Syntax Highlighting]
    └──requires──> [Markdown Rendering]

[Conversation Rename]
    └──requires──> [Cross-session Persistence]
    └──requires──> [Conversation List / Sidebar]

[Model Switcher]
    └──enhances──> [Streaming Output]
    └──requires──> [DB column: chat.model (optional for per-chat persistence)]

[Stop Generation]
    └──uses──> [useChat `stop()` built-in]
    └──requires──> [Loading Indicator] (button must be visible while streaming)
```

### Dependency Notes

- **Cross-session Persistence requires DB schema:** The entire persistence feature tree (list, load, rename, auto-title) is blocked until Drizzle schema and migrations run. This is the highest-priority infrastructure item.
- **Conversation List requires Routing:** The sidebar must know how to navigate to `/chat/[id]` — App Router dynamic segments must be wired before sidebar is functional.
- **Load Existing Chat requires `initialMessages`:** `useChat` accepts an `initialMessages` prop; the parent page component must fetch messages from DB (server component or loader) and pass them down before the hook initializes.
- **Regenerate enhances but complicates Persistence:** `useChat.reload()` re-runs the last user message client-side; the old assistant message must be deleted from DB and the new one saved — this is where a simple UI feature touches two DB operations.
- **Code Highlighting requires Markdown:** The syntax highlighter only fires inside fenced code blocks, which only exist once the markdown renderer (`react-markdown`) is in place.

## Hidden Complexity Flags

### Streaming + Postgres Persistence Together

**Looks simple, is not.** The naive approach (save messages after `onFinish`) hides several traps:

1. **`onFinish` message access bug:** `useChat`'s client-side `onFinish` only receives the last assistant message, not the full conversation. The user message must be saved separately — either optimistically before `handleSubmit` or via a server-side `onFinish` in the Route Handler.
2. **Where to save:** Saving from the client (`useChat`'s `onFinish`) means an extra POST round-trip after streaming ends. Saving from the server (Route Handler `onFinish` callback) is more reliable but requires passing the `chatId` in the request body.
3. **Race condition:** UI refresh that re-fetches chat list can fire before the DB write from `onFinish` commits, showing stale data. The Vercel AI chatbot reference repo had this exact bug (PR #404). Fix: trigger refresh only after confirmed DB write, not on stream close.
4. **Partial messages on error:** If the stream errors mid-response, the partial assistant message may never be saved (or saved incomplete). Decide upfront: save on error with a `[stream interrupted]` marker, or discard. Discarding is simplest for demo.

**Recommended pattern:** Save the user message server-side at the start of the Route Handler (before calling `streamText`). Save the assistant message server-side in `streamText`'s `onFinish` callback. Pass `chatId` in the request body from `useChat`'s `body` option.

### Markdown Rendering During Streaming

**Streaming + markdown parser = incremental parse thrash.** As tokens arrive, the markdown string is syntactically incomplete (e.g., `**bold` has no closing `**` yet). Parsers handle this differently:
- `react-markdown` re-parses the entire string on each token — fine for short messages, noticeable jank on long ones.
- Code blocks are worst: a triple-backtick fence with no closing fence renders as a paragraph until the fence closes. This causes a visual "flicker" from paragraph → code block mid-stream.
- **Mitigation:** Render plain text during streaming, switch to markdown only on `isLoading === false`. Simpler and visually cleaner for a demo.

### Conversation List with Real-Time Updates

The sidebar needs to show the new conversation immediately when a user starts one. Without care this requires either: (a) a full page reload, (b) a client-side state update, or (c) router cache invalidation via `router.refresh()`. Option (c) is the App Router idiom — call `router.refresh()` after chat creation and after each completed message to keep sidebar counts/titles fresh.

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the core value: "streaming works, history is saved."

- [ ] Streaming output — core value statement, first thing demoed
- [ ] Send/receive messages (useChat wired to Route Handler) — prerequisite for everything
- [ ] Multi-turn context — without this it is not a chatbot, it is a one-shot prompter
- [ ] Cross-session message persistence (Postgres via Drizzle) — "history is saved" half of core value
- [ ] Conversation list sidebar — navigate past chats; shows persistence is working
- [ ] New chat creation — create, not just read
- [ ] Load existing chat — complete the CRUD story
- [ ] Loading indicator — demo requirement; without it streaming looks broken on slow networks
- [ ] Error states — demo safety net; API key issues must not cause a blank screen

### Add After Validation (v1.x)

Features to add once core loop is working and stable.

- [ ] Markdown rendering — add when core loop works; immediately improves demo quality
- [ ] Code syntax highlighting — add right after markdown; required for dev-audience demos
- [ ] Stop generation — quick win via `useChat.stop()`; add with markdown pass
- [ ] Copy message button — 15-line addition; high perceived value in demo
- [ ] Scroll-to-bottom auto-scroll — polish; add last in v1.x pass
- [ ] Conversation rename — add if time permits; improves sidebar demo story

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Auto-title from first message — nice but costs an extra LLM call and adds latency; defer
- [ ] Model switcher — schema change + UI; defer unless demo audience specifically cares about GPT-4o vs mini comparison
- [ ] Keyboard shortcuts — polish; not blocking anything
- [ ] Regenerate response — requires careful DB sync; medium complexity for medium value; defer to v2

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Streaming output | HIGH | LOW (useChat handles it) | P1 |
| Send/receive messages | HIGH | LOW (useChat handles it) | P1 |
| Multi-turn context | HIGH | LOW (useChat handles it) | P1 |
| Cross-session persistence | HIGH | MEDIUM (DB + onFinish pattern) | P1 |
| Conversation list sidebar | HIGH | MEDIUM (DB query + routing) | P1 |
| New chat creation | HIGH | LOW | P1 |
| Load existing chat | HIGH | LOW (initialMessages prop) | P1 |
| Loading indicator | MEDIUM | LOW (isLoading flag) | P1 |
| Error states | MEDIUM | LOW (error flag) | P1 |
| Markdown rendering | MEDIUM | LOW (react-markdown) | P2 |
| Code syntax highlighting | MEDIUM | LOW-MEDIUM | P2 |
| Stop generation | MEDIUM | LOW (stop() built-in) | P2 |
| Copy message button | MEDIUM | LOW | P2 |
| Scroll-to-bottom | LOW | LOW-MEDIUM | P2 |
| Conversation rename | LOW | LOW-MEDIUM | P2 |
| Auto-title generation | LOW | MEDIUM | P3 |
| Model switcher | LOW | MEDIUM | P3 |
| Regenerate response | LOW | MEDIUM | P3 |
| Keyboard shortcuts | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch — demo fails without it
- P2: Should have — demo is noticeably better with it
- P3: Nice to have — only if P1+P2 are done and time remains

## Competitor Feature Analysis

| Feature | ChatGPT | Claude.ai | Our Approach |
|---------|---------|-----------|--------------|
| Streaming output | Token-by-token with cursor | Token-by-token with cursor | Vercel AI SDK SSE — identical experience |
| Conversation sidebar | Left sidebar, grouped by date | Left sidebar, flat list | Left sidebar, flat list (simpler, 1-week scope) |
| Markdown + code highlight | Full GFM + syntax highlight | Full GFM + syntax highlight | `react-markdown` + `react-syntax-highlighter` |
| New chat button | Prominent top-left | Top-left | Top of sidebar |
| Conversation rename | Click title to rename | Click pencil icon | Inline edit or dedicated button |
| Stop generation | Visible stop button during stream | Visible stop button | `useChat.stop()` wired to button |
| Copy message | Hover to reveal copy button | Hover actions bar | Hover-reveal copy icon |
| Model switcher | Dropdown in chat header | Model selector | Deferred to v2 |
| Auth / accounts | Required | Required | Explicitly out of scope |
| File uploads | GPT-4o vision support | PDF/image support | Explicitly out of scope |

## useChat Hook: Built-in vs Custom Code Summary

Quick reference for implementation planning.

| Capability | Handled by useChat? | What's needed |
|------------|--------------------|-----------------------------|
| Streaming token display | YES — automatic | Wire `messages` to JSX |
| Input state management | YES — automatic | Wire `input` + `handleInputChange` |
| Form submit + API call | YES — automatic | Wire `handleSubmit` to `<form>` |
| Multi-turn message array | YES — automatic | Pass `messages` array in Route Handler |
| Loading state | YES — `isLoading` flag | Wire to spinner/button disable |
| Error state | YES — `error` object | Wire to error message UI |
| Stop streaming | YES — `stop()` function | Wire to cancel button |
| Reload/regenerate | YES — `reload()` function | Wire to regenerate button; sync DB manually |
| Initial messages (load chat) | YES — `initialMessages` prop | Fetch from DB in server component, pass down |
| DB persistence | NO | Server-side `onFinish` in Route Handler |
| Conversation list | NO | Separate DB query + sidebar component |
| New chat creation | NO | Route Handler POST + redirect |
| Conversation rename | NO | PATCH endpoint + inline UI |
| Markdown rendering | NO | `react-markdown` component |
| Code highlighting | NO | `react-syntax-highlighter` inside markdown |
| Auto-title | NO | Second `generateText` call or string truncation |
| Model switching per chat | NO | `body` option + DB column |

## Sources

- Vercel AI SDK official docs: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- Vercel AI SDK `useChat` reference: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Vercel AI chatbot reference repo race condition fix: https://github.com/vercel/ai-chatbot/pull/404
- GitHub discussion — onFinish message access: https://github.com/vercel/ai/discussions/2013
- GitHub issue — onFinish stale messages bug: https://github.com/vercel/ai/issues/550
- `react-markdown` with streaming + syntax highlighting: https://athrael.net/blog/building-an-ai-chat-assistant/add-markdown-to-streaming-chat
- Chainlit race condition bug (real-world example): https://github.com/Chainlit/chainlit/issues/2789
- ChatGPT, Claude.ai — feature parity reference (direct product analysis)

---
*Feature research for: Streaming Chatbot (Next.js + Vercel AI SDK + OpenAI + Postgres)*
*Researched: 2025-07-14*
