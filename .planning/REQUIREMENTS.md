# Requirements: Streaming Chatbot

**Defined:** 2025-07-14
**Core Value:** A user can open the app, start chatting, and see the assistant's response appear word-by-word immediately — streaming works, history is saved, and the app runs without errors.

## v1 Requirements

Requirements for initial release. Each maps to a roadmap phase.

### Messaging

- [ ] **MSG-01**: User can type a message and send it to the LLM
- [ ] **MSG-02**: Assistant response is rendered in streaming mode — tokens appear as they arrive, not after full completion
- [ ] **MSG-03**: Multi-turn conversation is supported — full message history is sent to the LLM on each turn
- [ ] **MSG-04**: User sees a loading indicator while the assistant is responding
- [ ] **MSG-05**: User sees an error message if the LLM call fails (not a blank screen)

### Conversations

- [ ] **CONV-01**: User can create a new chat (new conversation session)
- [ ] **CONV-02**: User can view a list of all past conversations in a sidebar
- [ ] **CONV-03**: User can open an existing conversation and see its full message history
- [ ] **CONV-04**: User can update (rename) a conversation
- [ ] **CONV-05**: User can delete a conversation and all its messages

### Persistence

- [ ] **PERS-01**: Chat records are stored in Postgres (create chat on new conversation)
- [ ] **PERS-02**: Each user message is persisted to Postgres before the LLM call
- [ ] **PERS-03**: Each assistant response is persisted to Postgres after streaming completes (via onFinish)
- [ ] **PERS-04**: Fetching a conversation's messages from Postgres and loading them into the chat view works correctly

### Backend Reliability

- [ ] **RELY-01**: The backend retries LLM calls on transient failure (timeout, 5xx, network error) — at minimum 2 retries with backoff
- [ ] **RELY-02**: Retry logic does not duplicate messages — user message is saved once before retry attempts begin
- [ ] **RELY-03**: Errors after all retries are exhausted are surfaced to the user (not swallowed silently)

### Infrastructure

- [ ] **INFRA-01**: App reads `OPENAI_API_KEY` and `DATABASE_URL` from environment variables
- [ ] **INFRA-02**: Drizzle ORM schema is defined with `chats` and `messages` tables
- [ ] **INFRA-03**: Database migrations are managed with `drizzle-kit generate` + `migrate` (not push)
- [ ] **INFRA-04**: App runs locally with `npm run dev` after setting environment variables

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Polish

- **PLSH-01**: Assistant messages are rendered as markdown (bold, code blocks, lists)
- **PLSH-02**: Code blocks in assistant messages have syntax highlighting
- **PLSH-03**: User can stop generation mid-stream with a Stop button
- **PLSH-04**: User can copy any message to clipboard
- **PLSH-05**: Conversations are auto-titled from the first message content

### Advanced Features

- **ADV-01**: Model switcher — user can select which OpenAI model to use per conversation
- **ADV-02**: Regenerate response — user can ask the LLM to retry the last assistant message
- **ADV-03**: Keyboard shortcuts (Cmd+Enter to send, Cmd+N for new chat)

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication / accounts | Single-user demo; adds significant complexity |
| File / image uploads | Text-only scope; storage integration out of scope |
| Voice input / output | Out of scope for demo |
| Real-time multi-tab sync | Single session; adds WebSocket complexity |
| Production deployment (Vercel, etc.) | Local demo is the deliverable |
| System prompt editor | Not in requirements; adds scope |
| Message editing / branching | Branching creates conversation tree complexity |
| Export / share conversations | Not in requirements |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| MSG-01 | Phase 2 | Pending |
| MSG-02 | Phase 2 | Pending |
| MSG-03 | Phase 2 | Pending |
| MSG-04 | Phase 2 | Pending |
| MSG-05 | Phase 2 | Pending |
| PERS-01 | Phase 2 | Pending |
| PERS-02 | Phase 2 | Pending |
| PERS-03 | Phase 2 | Pending |
| PERS-04 | Phase 2 | Pending |
| RELY-01 | Phase 2 | Pending |
| RELY-02 | Phase 2 | Pending |
| RELY-03 | Phase 2 | Pending |
| CONV-01 | Phase 3 | Pending |
| CONV-02 | Phase 3 | Pending |
| CONV-03 | Phase 3 | Pending |
| CONV-04 | Phase 3 | Pending |
| CONV-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 21 total (INFRA-01–04, MSG-01–05, CONV-01–05, PERS-01–04, RELY-01–03)
- Mapped to phases: 21
- Unmapped: 0 ✓

*Note: Earlier drafts of this file stated 18 requirements. The correct count is 21. The traceability table above is authoritative.*

---
*Requirements defined: 2025-07-14*
*Last updated: 2025-07-14 — traceability updated after roadmap creation; coverage corrected to 21*
