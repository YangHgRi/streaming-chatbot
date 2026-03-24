# Project State: Streaming Chatbot

**Last updated:** 2026-03-24
**Project definition:** See [PROJECT.md](./PROJECT.md)
**Roadmap:** See [ROADMAP.md](./ROADMAP.md)
**Requirements:** See [REQUIREMENTS.md](./REQUIREMENTS.md)

## Current Phase

**Phase 1 — Foundation** (Plan 01 complete, Plan 02 next)

Establishing the project scaffold, pinned package versions, Drizzle schema, database migrations, and environment variable wiring. No feature code is written until this phase is complete and verified.

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Foundation | INFRA-01–04 | **In Progress** (1/2 plans done) |
| 2 | Core Loop | MSG-01–05, PERS-01–04, RELY-01–03 | Not started |
| 3 | Conversations UI | CONV-01–05 | Not started |

## Requirement Status

| ID | Phase | Status |
|----|-------|--------|
| INFRA-01 | 1 | Complete (01-01) |
| INFRA-02 | 1 | Pending |
| INFRA-03 | 1 | Pending |
| INFRA-04 | 1 | Complete (01-01) |
| MSG-01 | 2 | Pending |
| MSG-02 | 2 | Pending |
| MSG-03 | 2 | Pending |
| MSG-04 | 2 | Pending |
| MSG-05 | 2 | Pending |
| PERS-01 | 2 | Pending |
| PERS-02 | 2 | Pending |
| PERS-03 | 2 | Pending |
| PERS-04 | 2 | Pending |
| RELY-01 | 2 | Pending |
| RELY-02 | 2 | Pending |
| RELY-03 | 2 | Pending |
| CONV-01 | 3 | Pending |
| CONV-02 | 3 | Pending |
| CONV-03 | 3 | Pending |
| CONV-04 | 3 | Pending |
| CONV-05 | 3 | Pending |

**Coverage: 21 / 21 v1 requirements assigned. 2 complete (INFRA-01, INFRA-04).**

## Phase Completion Gates

A phase is complete when all of its success criteria (defined in ROADMAP.md) are observable in the running application — not when implementation tasks are checked off.

**Phase 1 gates:**
- `npm run dev` starts cleanly with only env vars set
- `drizzle-kit migrate` creates the correct schema on a fresh DB
- A Server Component query executes without error
- No hardcoded credentials anywhere in source

**Phase 2 gates:**
- First streaming token arrives before full response completes (`Transfer-Encoding: chunked` visible in DevTools)
- Full page reload after a conversation restores all messages from Postgres
- Loading indicator tracks the assistant response lifecycle precisely
- User message persists exactly once even when retries fire
- Exhausted retries produce a visible error in the chat UI

**Phase 3 gates:**
- Sidebar lists all conversations; clicking any one loads its history
- New Chat creates and navigates to a fresh conversation; sidebar updates immediately
- Rename persists after a full page reload
- Delete removes conversation and all messages from the DB
- Mid-stream chat switch does not leak tokens into the destination conversation

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-07-14 | 3-phase structure (Foundation / Core Loop / Conversations UI) | Requirements group naturally into infra setup, the streaming+persistence loop, and the conversation-management UI shell. Adding a 4th polish phase would split v1 requirements across 4 phases without a clear dependency boundary. |
| 2025-07-14 | MSG, PERS, and RELY bundled in Phase 2 | These three groups cannot be independently verified — streaming without persistence is untestable and persistence without streaming is incomplete. Treating them as one cohesive unit reduces integration risk. |
| 2026-03-24 | create-next-app scaffolds into scaffold-tmp/ then moved to root | CLI refuses to scaffold into existing dirs with non-standard files (.planning/). Workaround: scaffold then copy. All .git/ and .planning/ preserved. |
| 2026-03-24 | Tailwind v4 installed (no tailwind.config.ts) | create-next-app@16.2.1 installs Tailwind v4 which uses @tailwindcss/postcss + postcss.config.mjs. No tailwind.config.ts file — this is correct v4 behavior. |
| 2026-03-24 | All runtime deps pinned without ^ | npm adds ^ by default. Manually edited package.json to remove ^ from all critical packages post-install. |

## Notes

- v2 requirements (PLSH-01–05, ADV-01–03) are tracked in REQUIREMENTS.md but not scheduled. They become candidates after Phase 3 is complete.
- The REQUIREMENTS.md source listed the total as "18 requirements" but the actual count is 21. The traceability table in REQUIREMENTS.md is authoritative; the prose count has been corrected there.

---
*State file created: 2025-07-14*
*Last updated: 2026-03-24 — Plan 01 (scaffold-and-packages) complete*
