# Phase 1: Foundation - Context

**Gathered:** 2025-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the project scaffold: Next.js App Router project with pinned package versions, Drizzle ORM schema (`chats` + `messages` tables), database migrations committed to the repo, and environment variable wiring. No feature code. Phase 2 cannot begin until `npm run dev` starts cleanly, `drizzle-kit migrate` creates the correct schema, and a Server Component query executes without error.

</domain>

<decisions>
## Implementation Decisions

### Bootstrap Method
- **D-01:** Use the official `create-next-app` CLI to initialize the project — not a manual setup from scratch.
- **D-02:** Accept the default options that align with the stack (App Router, TypeScript). Tailwind CSS is installed at init time (see D-03).

### Local Development Database
- **D-03:** Target a locally running PostgreSQL server (not Docker Compose, not a cloud service like Neon or Supabase). `DATABASE_URL` in `.env.local` points to `localhost`. The `.env.local.example` template must document this clearly.

### CSS / Styling Foundation
- **D-04:** Install Tailwind CSS during `create-next-app` initialization. It will be available for Phase 3 (Conversations UI) without any additional setup step.

### Claude's Discretion
- Exact `create-next-app` flags (e.g., `--turbopack`, `--src-dir`, `--import-alias`) — choose whatever aligns best with the recommended project structure in ARCHITECTURE.md.
- ESLint configuration — use the Next.js default.
- Drizzle config file format (`drizzle.config.ts` vs `.js`) — use TypeScript.
- `nanoid` vs `crypto.randomUUID()` for ID generation — choose based on what requires fewer dependencies (prefer `crypto.randomUUID()` which is built-in to Node 18+).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack versions & package choices
- `.planning/research/STACK.md` — Pinned versions for every package (`next@16.2.1`, `ai@6.0.137`, `@ai-sdk/react@3.0.139`, `@ai-sdk/openai@3.0.48`, `drizzle-orm@0.45.1`, `drizzle-kit@0.31.10`, `postgres@3.4.8`, `zod@4.3.6`). Also lists what NOT to install and why.

### Architecture & project structure
- `.planning/research/ARCHITECTURE.md` — Canonical directory layout (`src/app/`, `src/lib/db/`, `drizzle/migrations/`), schema definitions with exact column types and constraints, Drizzle client singleton pattern, and drizzle.config.ts setup.

### Critical pitfalls to avoid in Phase 1
- `.planning/research/PITFALLS.md` §Pitfall 1 — Import path split (`"ai"` vs `"ai/react"` vs `"@ai-sdk/openai"`): lock imports in the route stub now.
- `.planning/research/PITFALLS.md` §Pitfall 7 — Never use `drizzle-kit push`; use `generate` + `migrate` from day one.
- `.planning/research/PITFALLS.md` §Pitfall 8 — Schema drift: run `generate` + `migrate` every time `schema.ts` changes.
- `.planning/research/PITFALLS.md` §Pitfall 9 — Postgres connection exhaustion: implement the `globalThis` singleton guard in `lib/db/index.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- Not yet established. CLAUDE.md §Conventions reads "Conventions not yet established. Will populate as patterns emerge during development." — Phase 1 sets the first patterns.

### Integration Points
- The only integration point in Phase 1 is the `app/api/chat/route.ts` stub: correct imports must be locked (`streamText` from `"ai"`, `useChat` from `"ai/react"`, provider from `"@ai-sdk/openai"`) and `export const dynamic = "force-dynamic"` must be set. This stub is consumed by Phase 2.

</code_context>

<specifics>
## Specific Ideas

- The route Handler stub (`app/api/chat/route.ts`) is explicitly called out in the ROADMAP as a Phase 1 deliverable — its imports must be correct before Phase 2 feature code is written. This is not boilerplate; it is a hard dependency for Phase 2.
- ROADMAP explicitly calls for the `globalThis` singleton guard in `lib/db/index.ts` to prevent connection exhaustion on hot reload.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2025-07-14*
