# Phase 2: Core Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 02-core-loop
**Areas discussed:** Message appearance, Loading & error feedback, Phase 2 chat access

---

## Message Appearance

| Option | Description | Selected |
|--------|-------------|----------|
| ChatGPT-style aligned bubbles | User right/gray, assistant left/white — consistent with stated ChatGPT-style reference, achievable quickly with Tailwind | ✓ |
| Symmetric layout | Both sides centered or same side — simpler but less familiar UX | |
| Full-width cards | Each message spans the full width — common in some chat UIs | |

**User's choice:** As recommended — ChatGPT-style aligned bubbles (user right, assistant left).
**Notes:** No avatars required; alignment differentiates roles. Tailwind utilities only, no custom CSS.

---

## Loading & Error Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsing dots in message thread | Animated indicator rendered as a message bubble in the thread where the response will appear | ✓ |
| Spinner outside the thread | Loading spinner near the input or in a fixed position — doesn't map to ROADMAP SC3 as directly | |
| Disabled input only | No visual loading state in the thread — minimal but harder to verify SC3 | |

**User's choice:** As recommended — pulsing dots in the message thread.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error bubble in thread | Error appears where the response would have been, inside the conversation | ✓ |
| Toast notification | Floating toast — easy to miss, not persistent | |
| Banner below input | Error below the input field — separated from the conversation context | |

**User's choice:** As recommended — inline error bubble in the chat thread.
**Notes:** Input and submit button disabled while `isLoading`. Error appears in the thread, not outside it.

---

## Phase 2 Chat Access (Root Page)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal "Start Chat" button | Creates a chat row + redirects to `/chat/<id>`; root page stub, replaced by Phase 3 | ✓ |
| Leave as DB smoke test + navigate manually | No button — developer manually crafts URL; friction during testing | |
| Auto-create + redirect now | Phase 3's final UX — could steal Phase 3 work and create duplication | |

**User's choice:** As recommended — minimal "Start Chat" button on root page.
**Notes:** Phase 3 will replace `app/page.tsx` with auto-create + redirect. Planner should note this transition explicitly so Phase 3 doesn't miss it.

---

## Claude's Discretion

- Exact pulsing dots animation implementation
- `<textarea>` vs `<input type="text">` for MessageInput
- Exact Tailwind color values for message bubbles
- Whether loading indicator is a separate component or conditional inside MessageList
- Retry implementation approach (hand-rolled vs library)

## Deferred Ideas

None — discussion stayed within phase scope.
