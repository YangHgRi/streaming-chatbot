# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2025-07-14
**Phase:** 01-foundation
**Areas discussed:** Bootstrap method, Local dev database, CSS/styling foundation

---

## Bootstrap Method

| Option | Description | Selected |
|--------|-------------|----------|
| `create-next-app` (official CLI) | Initializes the project with official tooling, sets App Router, TypeScript, and optional add-ons interactively | ✓ |
| Manual setup from scratch | Manually create `package.json`, `tsconfig.json`, `next.config.ts`, directory structure without scaffolding CLI | |

**User's choice:** Use the official `create-next-app` CLI tool.
**Notes:** No additional clarification needed. Aligns with standard Next.js onboarding.

---

## Local Development Database

| Option | Description | Selected |
|--------|-------------|----------|
| Local PostgreSQL server | Connect `DATABASE_URL` to a locally running Postgres instance (e.g., system-installed or via existing local server) | ✓ |
| Docker Compose in repo | Bundle a `docker-compose.yml` that spins up Postgres as part of the project | |
| External cloud Postgres | Use Neon, Supabase, or Railway free tier; `DATABASE_URL` points to a remote instance | |

**User's choice:** Connect to a local PostgreSQL server.
**Notes:** No Docker Compose file needed in the repo. `.env.local.example` should document `DATABASE_URL=postgresql://user:password@localhost:5432/dbname` as the template.

---

## CSS / Styling Foundation

| Option | Description | Selected |
|--------|-------------|----------|
| Install Tailwind CSS at init | Select Tailwind when `create-next-app` prompts during initialization | ✓ |
| Add Tailwind in Phase 3 | Defer Tailwind setup; Phase 3 adds and configures it when the UI is built | |
| No Tailwind (plain CSS modules) | Use Next.js CSS Modules only; no utility-first framework | |

**User's choice:** Install Tailwind CSS during `create-next-app` initialization.
**Notes:** Available from day one for all phases. Phase 3 can use it immediately without any additional setup.

---

## Claude's Discretion

- Exact `create-next-app` CLI flags
- ESLint configuration
- Drizzle config file format
- ID generation strategy (`crypto.randomUUID()` vs `nanoid`)

## Deferred Ideas

None.
