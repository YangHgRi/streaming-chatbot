# Repository Guidelines

## Project Overview

**Streaming Chat** is a full-stack AI chatbot built with Next.js 16, React 19, and the Vercel AI SDK. It provides real-time streaming conversations backed by OpenAI, with persistent multi-chat management, per-chat system prompts, share links, and Markdown/JSON export. The entire application lives in a single Next.js App Router project — no monorepo.

---

## Architecture & Data Flow

The app uses a layered Next.js App Router architecture with a clear boundary between server and client:

```
PostgreSQL (Drizzle ORM)
    ↓
src/lib/db/queries.ts       — React.cache()-wrapped data access layer
    ↓
Server Components           — Async RSC for initial data fetching (Sidebar, chat page)
Server Actions              — Mutations with revalidatePath (src/app/actions.ts)
API Routes                  — Streaming & LLM calls (src/app/api/)
    ↓
Client Components           — Interactivity & streaming state (ChatInterface, MessageList, etc.)
```

**Message streaming flow:**
1. User sends message → `useChat` (AI SDK) POSTs to `/api/chat`
2. API route persists the user message to DB **before** calling the LLM (idempotent via `onConflictDoNothing`)
3. `streamText()` streams the response to the client
4. `onFinish` callback persists the assistant reply; `onError` persists an error sentinel message
5. After the first assistant response, `/api/chat/[chatId]/title` is called to auto-generate a title
6. Server Actions use `revalidatePath('/', 'layout')` to invalidate the sidebar cache

**Key architectural decisions:**
- Server Components only fetch; mutations always go through Server Actions or API routes
- `React.cache()` provides request-scoped memoization for all DB reads
- `ERROR_SENTINEL_PREFIX` (`__ERROR__:`) persists LLM errors as messages so they survive page reloads
- DB connection uses a global singleton to prevent pool exhaustion during Next.js HMR

---

## Key Directories

```
src/
├── app/
│   ├── page.tsx                        # Home — redirects to latest/new chat
│   ├── layout.tsx                      # Root layout: ThemeProvider + SidebarProvider + Sidebar
│   ├── globals.css                     # Tailwind 4 + custom animations
│   ├── error.tsx                       # Global error boundary
│   ├── not-found.tsx                   # 404 page
│   ├── actions.ts                      # All 'use server' mutations
│   ├── api/
│   │   └── chat/
│   │       ├── route.ts                # POST — streaming chat endpoint
│   │       └── [chatId]/
│   │           ├── title/route.ts      # POST — auto-title generation
│   │           └── export/route.ts     # GET — Markdown/JSON export
│   ├── chat/[chatId]/page.tsx          # Main chat page (RSC)
│   └── share/[shareId]/page.tsx        # Public read-only share view
├── components/
│   ├── ChatInterface.tsx               # 'use client' — streaming state, toasts, keyboard shortcuts
│   ├── MessageList.tsx                 # 'use client' — message rendering, copy/edit/delete/refresh
│   ├── MessageInput.tsx                # 'use client' — auto-grow textarea, Enter to send
│   ├── CodeBlock.tsx                   # 'use client' — Prism syntax highlighting (dynamic import)
│   ├── Sidebar.tsx                     # RSC — fetches chats, renders SidebarClient
│   ├── SidebarClient.tsx               # 'use client' — search, pin, rename, delete, date grouping
│   ├── SidebarProvider.tsx             # 'use client' — React Context for mobile sidebar toggle
│   ├── SystemPromptModal.tsx           # 'use client' — per-chat system prompt editor
│   ├── ShareButton.tsx                 # 'use client' — lazy share link generation + copy popup
│   ├── ThemeProvider.tsx               # Server wrapper re-export from @wrksz/themes/next
│   ├── ThemeToggle.tsx                 # 'use client' — useSyncExternalStore to avoid hydration mismatch
│   └── MobileSidebarToggle.tsx         # 'use client' — hamburger menu (hidden on md+)
├── lib/
│   ├── db/
│   │   ├── schema.ts                   # Drizzle schema: chats + messages tables
│   │   ├── index.ts                    # DB connection pool singleton
│   │   └── queries.ts                  # All CRUD operations (React.cache()-wrapped)
│   └── getTextContent.ts               # Extracts plain text from UIMessage parts
└── constants/
    └── index.ts                        # DEFAULT_CHAT_TITLE, ERROR_SENTINEL_PREFIX, ROLE_* literals

drizzle/                                # Generated migration files (do not edit manually)
public/                                 # Static assets
.env.local.example                      # Environment variable template
```

---

## Development Commands

```bash
# Start dev server (Turbopack)
npm run dev

# Production build
npm run build

# Run production server
npm run start

# Lint (ESLint 9 flat config)
npm run lint

# Database: generate migrations after schema changes
npm run db:generate

# Database: apply pending migrations
npm run db:migrate

# Database: open Drizzle Studio (visual DB browser)
npm run db:studio

# Database: check schema consistency
npm run db:check
```

### First-time setup

```bash
cp .env.local.example .env.local
# Fill in OPENAI_API_KEY and DATABASE_URL
npm install
npm run db:migrate
npm run dev
```

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string; validated at startup |
| `OPENAI_API_KEY` | Yes | — | Validated at module load in `/api/chat/route.ts` |
| `OPENAI_API_BASE_URL` | No | OpenAI official | Supports Azure, proxies, compatible endpoints |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Switch models without code changes |

Both required variables throw clear errors at startup if missing — do not silence these.

---

## Code Conventions & Common Patterns

### TypeScript
- **Strict mode** is enabled; use type guards (`is` keyword) over type casts
- Use **inferred Drizzle types**: `Chat = typeof chats.$inferSelect`, not hand-written interfaces
- **`as const`** for role literals: `ROLE_USER = 'user' as const`
- **`Partial<Pick<Chat, …>>`** pattern to restrict which fields can be updated (`updateChat`)
- Path alias `@/` maps to `src/` — always use it for imports

### React & Next.js
- **Server Components** handle all initial data fetching; they are `async` functions using `await`
- **Client Components** are marked `'use client'` at the top and handle all interactivity
- **Server Actions** (`'use server'`) handle mutations; always call `revalidatePath('/', 'layout')` after writes that affect the sidebar
- Use **`useTransition`** for async Server Action calls to track pending state
- **`React.cache()`** wraps all query functions in `queries.ts` — do not bypass this
- Parallel data fetching: `const [chat, messages] = await Promise.all([getChat(id), getMessages(id)])`
- Dynamic route params are `Promise`s in Next.js 15+: `const { chatId } = await params`

### Error Handling
- Persist LLM errors with `ERROR_SENTINEL_PREFIX` (`__ERROR__:`) so they survive navigation
- Filter out sentinel-prefixed messages in export and share views
- Use `notFound()` for missing resources, `error.tsx` for unexpected errors
- Validate `OPENAI_API_KEY` and `DATABASE_URL` at **module load time** with descriptive messages
- Never silently swallow DB errors; `console.error` before re-throwing

### State Management
- **Streaming state**: `useChat()` from `@ai-sdk/react` (messages, status, stop, reload)
- **Sidebar mobile state**: `SidebarProvider` React Context (`isOpen`, `open`, `close`, `toggle`)
- **Component-level state**: `useState` for modals, toasts, forms; `useRef` for DOM refs
- No Redux, Zustand, or other global state libraries

### Naming
- Components: `PascalCase` (`ChatInterface`, `MessageList`)
- Constants: `UPPER_SNAKE_CASE` (`ERROR_SENTINEL_PREFIX`, `DEFAULT_CHAT_TITLE`)
- Functions/hooks: `camelCase` (`createChat`, `getMessages`, `useSidebarContext`)
- Prefer semantic names: `chatId` not `id`; `fromMessageId` not `msgId`

### Styling
- **Tailwind CSS v4** with utility classes inline — no CSS Modules or styled-components
- Custom animations defined in `src/app/globals.css` (not in component files)
- Dark mode uses explicit `.dark` class (not `prefers-color-scheme`) via `@wrksz/themes`
- `dark:` variant is available on all elements

### Performance Patterns
- **Dynamic import** heavy components: `CodeBlock` uses `next/dynamic` for Prism (~300–500 KB)
- **Debounce** search inputs: 300ms with a `requestId` guard to prevent stale results
- **Module-level RegExp** compilation (not inside render functions)
- `onConflictDoNothing()` makes message inserts idempotent for client retries
- Stable refs for Markdown component map (prevents CodeBlock remounting on re-render)

### Comments
The codebase uses tagged inline comments explaining non-obvious decisions:
- `// server-cache-react:` — explains `React.cache()` usage
- `// bundle-dynamic-imports:` — explains `next/dynamic` code-splitting
- `// js-hoist-regexp:` — explains module-level RegExp hoisting
- `// rerender-*:` — explains render stability decisions
- `// async-parallel:` — explains `Promise.all` patterns

Follow this convention when adding similar non-obvious logic.

---

## Important Files

| File | Purpose |
|---|---|
| `src/app/actions.ts` | All server-side mutations; start here for any write operation |
| `src/lib/db/queries.ts` | All database reads/writes; never call `db` directly from components |
| `src/lib/db/schema.ts` | Source of truth for DB types — modify here, then run `db:generate` |
| `src/constants/index.ts` | Shared constants including `ERROR_SENTINEL_PREFIX` |
| `src/app/api/chat/route.ts` | Streaming endpoint — core of the LLM integration |
| `src/components/ChatInterface.tsx` | Main chat orchestrator; `useChat` hook lives here |
| `.env.local.example` | Template for all required/optional environment variables |
| `drizzle.config.ts` | Drizzle Kit config pointing to schema and migrations |
| `eslint.config.mjs` | ESLint 9 flat config |

---

## Runtime & Tooling

- **Runtime**: Node.js (primary). Both `package-lock.json` and `bun.lock` are present; use **npm** as the default package manager unless explicitly told otherwise.
- **Framework**: Next.js 16.2.1 with App Router
- **Bundler**: Turbopack in development (`next dev --turbopack`), standard Next.js bundler for production builds
- **TypeScript**: v5, strict mode, `moduleResolution: bundler`
- **Linting**: ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. No Prettier or Biome configured.
- **Styling**: Tailwind CSS v4 via PostCSS (`postcss.config.mjs`)
- **ORM**: Drizzle ORM 0.45.1 — always use the query builder, never raw SQL strings

### Database Schema Changes

Always follow this workflow:
1. Edit `src/lib/db/schema.ts`
2. Run `npm run db:generate` to create a migration file in `drizzle/`
3. Run `npm run db:migrate` to apply it
4. Update types/queries in `src/lib/db/queries.ts` as needed

---

## Testing & QA

**No test framework is currently configured.** There are no test files, test directories, or test scripts in this project.

Quality is maintained through:
- **TypeScript strict mode** — catches type errors at compile time
- **ESLint** (`npm run lint`) — Next.js core-web-vitals + TypeScript rules
- **Manual testing** via `npm run dev`

When adding tests, the recommended approach for this stack is **Vitest** (for unit/integration) with `@testing-library/react` for components, and **Playwright** for end-to-end tests. The `.gitignore` already includes `/coverage`.

---

## Database Schema Reference

```
chats
  id          text (PK, UUID)
  title       text (default: 'New Chat')
  titled      boolean (default: false) — has auto-title been generated?
  pinned      boolean (default: false) — pinned chats sort before others
  createdAt   timestamptz
  updatedAt   timestamptz — always touched on any mutation; drives sidebar sort order
  systemPrompt text | null
  shareId     text | null (unique) — UUID used in /share/[shareId]

messages
  id          text (PK, UUID)
  chatId      text (FK → chats.id, ON DELETE CASCADE)
  role        'user' | 'assistant' | 'system'
  content     text
  createdAt   timestamptz

  INDEX: messages_chat_id_idx on chatId
```

- Deleting a chat cascades to all its messages automatically
- Error messages are stored with `content` prefixed by `__ERROR__:` and must be filtered out before display/export
