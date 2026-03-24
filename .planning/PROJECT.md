# Streaming Chatbot

## What This Is

A demo-ready streaming chatbot built with Next.js, the Vercel AI SDK, and OpenAI. Users open the app, create chats, send messages, and see assistant responses streamed token-by-token in real time — no waiting for the full response. All chat history is persisted in Postgres. The interface follows a ChatGPT-style layout: sidebar listing conversations, message thread on the right.

## Core Value

A user can open the app, start chatting, and see the assistant's response appear word-by-word immediately — streaming works, history is saved, and the app runs without errors.

## Requirements

### Validated

- [x] Postgres stores all chat data via Drizzle ORM (configurable via `DATABASE_URL`) — *Validated in Phase 1: Foundation* (schema defined, migration committed)
- [x] App is demo-ready and runnable locally (scaffold, packages, env template, DB scripts) — *Validated in Phase 1: Foundation* (tsc passes, `npm run dev` requires `.env.local`)

### Active

- [ ] Users can send messages and receive streamed model responses (no full-response wait)
- [ ] Multi-turn conversation is supported (message history sent to LLM on each turn)
- [ ] Backend retries LLM calls on timeout or transient failures
- [ ] CRUD operations: create chat, create message, list chats, fetch messages for a chat, update chat, delete chat
- [ ] ChatGPT-like UI: sidebar with chat list, message thread on the right
- [ ] Single-user, no authentication required

### Out of Scope

- User authentication / multi-user support — single-user demo scope
- Deployment to production hosting (Vercel, etc.) — local runnable demo is the deliverable
- File/image uploads — text-only chat
- Real-time sync across multiple browser tabs — single session

## Context

- **Stack:** Next.js (App Router) + React + TypeScript, Vercel AI SDK, OpenAI (GPT-4o / GPT-4o-mini), Drizzle ORM, Postgres
- **LLM:** OpenAI — API key provided via environment variable (`OPENAI_API_KEY`)
- **Database:** Postgres configurable via `DATABASE_URL` environment variable — works with local Docker, Neon, Supabase, or any Postgres instance
- **Timeline:** 1 week
- **Primary goal:** Demo-ready — runs successfully and can be presented and verified

## Constraints

- **Tech Stack**: Next.js / React / TypeScript + Vercel AI SDK + OpenAI + Postgres + Drizzle ORM — fixed, no swaps
- **Timeline**: 1 week — scope is intentionally tight, no gold-plating
- **Auth**: None — single-user, open access
- **Database**: Configurable via `DATABASE_URL` — no hardcoded connection strings

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vercel AI SDK for streaming | Built-in streaming primitives for Next.js, handles SSE/ReadableStream plumbing | — Pending |
| Drizzle ORM over Prisma | Lighter weight, TypeScript-first, less boilerplate for a demo project | — Pending |
| OpenAI GPT-4o-mini as default model | Cost-effective for demos, fast responses, easy to swap to GPT-4o | — Pending |
| No auth | Single-user demo — reduces scope significantly | — Pending |
| App Router (Next.js) | Route Handlers work natively with Vercel AI SDK streaming | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 — Phase 1 Foundation execution complete (human verification pending db:migrate)*
