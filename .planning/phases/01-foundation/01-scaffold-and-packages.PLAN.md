---
wave: 1
depends_on: []
files_modified:
  - package.json
  - .env.local.example
  - tsconfig.json
autonomous: true
requirements:
  - INFRA-01
  - INFRA-04
  # Note: INFRA-02 and INFRA-03 are covered by Plan 02
---

# Plan 01 — Scaffold and Packages

## Goal

Bootstrap the Next.js App Router project, install all dependencies at pinned versions, wire environment variable templates, and add database npm scripts. At the end of this plan the project compiles, `npm run dev` starts (with env vars set), and all packages are in place for Plan 02 to write Drizzle files against.

## must_haves

- `package.json` lists `next@16.2.1`, `ai@6.0.137`, `@ai-sdk/react@3.0.139`, `@ai-sdk/openai@3.0.48`, `drizzle-orm@0.45.1`, `postgres@3.4.8`, `zod@4.3.6` at exact pinned versions
- `package.json` devDependencies lists `drizzle-kit@0.31.10` and `dotenv`
- `package.json` scripts contain `db:generate`, `db:migrate`, `db:studio`, `db:check`
- `.env.local.example` exists and contains `OPENAI_API_KEY=` and `DATABASE_URL=` placeholders
- `tsconfig.json` has `"strict": true` and `"@/*": ["./src/*"]` path alias
- `src/` directory exists with `src/app/` structure
- `npm run dev` starts without error after setting the two env vars

## Context

This is a greenfield project. Only `.git/` and `.planning/` exist at `D:\code_space\streaming-chatbot`. The `create-next-app` CLI scaffolds the project in place. Tailwind is installed at init time per decision D-04. The `src/` directory layout is used per decision in RESEARCH.md section 4.

---

## Wave 1 — Scaffold the Next.js App

<task id="T1-01" name="Run create-next-app to scaffold the project">
  <read_first>
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 4: create-next-app invocation and flags)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-CONTEXT.md (D-01 through D-04 decisions)
  </read_first>

  <action>
    Run the following command from `D:\code_space\streaming-chatbot`:

    ```
    npx create-next-app@16.2.1 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
    ```

    Note: RESEARCH.md Section 4 shows the command with a named subdirectory argument; use '.' here since the project root already exists with .git/ and .planning/ directories.

    Flag-by-flag justification:
    - `.` — scaffold into the current directory (project root already has .git and .planning)
    - `--typescript` — TypeScript is mandatory for this project
    - `--tailwind` — Decision D-04: Tailwind installed at init time for Phase 3 readiness
    - `--eslint` — use the Next.js default ESLint config
    - `--app` — App Router is required (not Pages Router)
    - `--src-dir` — all source files under `src/` as per ARCHITECTURE.md structure
    - `--import-alias "@/*"` — standard path alias; must match `"@/*": ["./src/*"]` in tsconfig
    - `--turbopack` — faster dev builds; no conflicts with this stack

    If the CLI prompts about overwriting an existing directory, confirm to proceed. The `.git/` and `.planning/` directories will not be affected.

    After scaffolding, confirm these directories and files exist:
    - `src/app/page.tsx`
    - `src/app/layout.tsx`
    - `src/app/globals.css`
    - `tailwind.config.ts`
    - `tsconfig.json`
    - `package.json`
    - `next.config.ts`
    - `.gitignore`
  </action>

  <acceptance_criteria>
    - `src/app/page.tsx` exists (file present on disk)
    - `src/app/layout.tsx` exists
    - `package.json` contains `"next": "16.2.1"` (exact version string)
    - `package.json` contains `"react": "19.2.4"` or `"^19"` (React 19 peer)
    - `tsconfig.json` exists with `"compilerOptions"` key present
    - `.gitignore` exists and contains `.env.local` line
    - `tailwind.config.ts` exists (Tailwind installed at init)
  </acceptance_criteria>
</task>

---

## Wave 2 — Install Pinned Dependencies

<task id="T1-02" name="Install runtime dependencies at pinned versions">
  <read_first>
    - D:\code_space\streaming-chatbot\package.json (current dependencies section — see what create-next-app already installed)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 3: Pinned Package Versions, What NOT to Install)
  </read_first>

  <action>
    Run the following command from `D:\code_space\streaming-chatbot`:

    ```
    npm install ai@6.0.137 @ai-sdk/react@3.0.139 @ai-sdk/openai@3.0.48 drizzle-orm@0.45.1 postgres@3.4.8 zod@4.3.6
    ```

    Install each package at the EXACT pinned version — do not allow npm to resolve a different version. If npm raises a peer dep warning (not error), proceed. If npm raises a peer dep error, investigate before proceeding.

    What create-next-app already installs (do NOT reinstall these manually):
    - `next@16.2.1` — already in package.json
    - `react@19.2.4` and `react-dom@19.2.4` — already in package.json
    - `typescript@6.0.2` — already in devDependencies

    Do NOT install any of these packages:
    - `openai` (raw npm package) — `@ai-sdk/openai` wraps it; mixing causes confusion
    - `drizzle-orm@1.0.0-beta.x` — beta track, API unstable
    - `@types/pg` — only for `pg` driver; this project uses `postgres`
    - `nanoid` — `crypto.randomUUID()` is used instead (Node 18+ built-in)
    - `pg` — `postgres@3.4.8` is the chosen driver
  </action>

  <acceptance_criteria>
    - `package.json` dependencies contains `"ai": "6.0.137"` (exact)
    - `package.json` dependencies contains `"@ai-sdk/react": "3.0.139"` (exact)
    - `package.json` dependencies contains `"@ai-sdk/openai": "3.0.48"` (exact)
    - `package.json` dependencies contains `"drizzle-orm": "0.45.1"` (exact)
    - `package.json` dependencies contains `"postgres": "3.4.8"` (exact)
    - `package.json` dependencies contains `"zod": "4.3.6"` (exact)
    - `node_modules/ai` directory exists
    - `node_modules/@ai-sdk/openai` directory exists
    - `node_modules/drizzle-orm` directory exists
    - `node_modules/postgres` directory exists
    - `node_modules/openai` does NOT exist as a direct dependency (check package.json — it may appear as a transitive dep in node_modules, which is fine)
  </acceptance_criteria>
</task>

<task id="T1-03" name="Install dev dependencies (drizzle-kit, dotenv)">
  <read_first>
    - D:\code_space\streaming-chatbot\package.json (current devDependencies)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 3: Dev Dependencies, Section 8: drizzle.config.ts needs dotenv)
  </read_first>

  <action>
    Run the following command from `D:\code_space\streaming-chatbot`:

    ```
    npm install -D drizzle-kit@0.31.10 dotenv
    ```

    Why `dotenv`:
    - `drizzle-kit` CLI runs outside of Next.js and does not auto-load `.env.local`
    - `drizzle.config.ts` must call `import 'dotenv/config'` at the top to load `DATABASE_URL` before drizzle-kit reads it
    - Without `dotenv`, `DATABASE_URL` is `undefined` when running `npm run db:migrate`, causing a cryptic silent failure

    Why `drizzle-kit@0.31.10`:
    - Must be kept in sync with `drizzle-orm@0.45.1`; kit version 0.31.x ↔ orm version 0.45.x
    - Do not install `drizzle-kit@latest` which may resolve to a beta or newer incompatible version

    `dotenv` version: use `^16` (no need to pin patch version; `^16` is a stable major).
  </action>

  <acceptance_criteria>
    - `package.json` devDependencies contains `"drizzle-kit": "0.31.10"` (exact)
    - `package.json` devDependencies contains `"dotenv"` (any `^16.x` version)
    - `node_modules/drizzle-kit` directory exists
    - `node_modules/dotenv` directory exists
    - Running `npx drizzle-kit --version` from `D:\code_space\streaming-chatbot` outputs `0.31.10`
  </acceptance_criteria>
</task>

---

## Wave 3 — npm Scripts, Environment Files, tsconfig Verification

<task id="T1-04" name="Add database npm scripts to package.json">
  <read_first>
    - D:\code_space\streaming-chatbot\package.json (existing scripts section — must not overwrite dev/build/start/lint)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 9: Add npm Scripts)
  </read_first>

  <action>
    Edit `package.json` to add the following four scripts to the `"scripts"` section. Preserve all existing scripts (`dev`, `build`, `start`, `lint`).

    Add these four entries:

    ```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check"
    ```

    The resulting scripts section must contain all of:
    ```json
    {
      "scripts": {
        "dev": "next dev --turbopack",
        "build": "next build",
        "start": "next start",
        "lint": "next lint",
        "db:generate": "drizzle-kit generate",
        "db:migrate": "drizzle-kit migrate",
        "db:studio": "drizzle-kit studio",
        "db:check": "drizzle-kit check"
      }
    }
    ```

    Note: The `dev` script may or may not include `--turbopack` depending on what `create-next-app` wrote — preserve whatever form it takes.
  </action>

  <acceptance_criteria>
    - `package.json` contains `"db:generate": "drizzle-kit generate"`
    - `package.json` contains `"db:migrate": "drizzle-kit migrate"`
    - `package.json` contains `"db:studio": "drizzle-kit studio"`
    - `package.json` contains `"db:check": "drizzle-kit check"`
    - `package.json` still contains `"dev":` (not removed)
    - `package.json` still contains `"build":` (not removed)
    - `package.json` is valid JSON (no trailing commas, no syntax errors)
  </acceptance_criteria>
</task>

<task id="T1-05" name="Create .env.local.example template (INFRA-01)">
  <read_first>
    - D:\code_space\streaming-chatbot\.gitignore (confirm .env.local is gitignored)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 10: Environment Variable Wiring)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-CONTEXT.md (D-03: local Postgres on localhost)
  </read_first>

  <action>
    Create the file `.env.local.example` at `D:\code_space\streaming-chatbot\.env.local.example` with this exact content:

    ```
    # .env.local.example
    # Copy this file to .env.local and fill in your values.
    # Never commit .env.local — it is gitignored by Next.js default.

    # OpenAI API key — get from https://platform.openai.com/api-keys
    OPENAI_API_KEY=sk-...your-key-here...

    # PostgreSQL connection string — local Postgres running on localhost
    # Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
    # Example: postgresql://postgres:postgres@localhost:5432/chatbot
    DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE
    ```

    Rules:
    - This file IS committed to git (it is a template, not secrets)
    - It must NOT contain any real API key or real database credentials
    - Both `OPENAI_API_KEY` and `DATABASE_URL` must appear as placeholder lines

    Also confirm `.gitignore` already contains `.env.local`. If it does NOT contain `.env.local`, add the line `.env.local` to `.gitignore`. (create-next-app adds it by default, so this should already be present.)

    Do NOT create `.env.local` itself with any hardcoded values. The developer sets up `.env.local` manually by copying `.env.local.example`.
  </action>

  <acceptance_criteria>
    - `.env.local.example` exists at project root (`D:\code_space\streaming-chatbot\.env.local.example`)
    - `.env.local.example` contains `OPENAI_API_KEY=` (line present)
    - `.env.local.example` contains `DATABASE_URL=` (line present)
    - `.env.local.example` contains `localhost` in the DATABASE_URL example comment line
    - `.env.local.example` does NOT contain any value starting with `sk-` followed by real characters (only the placeholder `sk-...your-key-here...` is acceptable)
    - `.gitignore` contains `.env.local` (line present, confirming real env file is gitignored)
    - `.env.local.example` is NOT listed in `.gitignore` (it must be committed, not ignored)
  </acceptance_criteria>
</task>

<task id="T1-06" name="Verify tsconfig.json has strict mode and path alias">
  <read_first>
    - D:\code_space\streaming-chatbot\tsconfig.json (the file generated by create-next-app — read before editing)
    - D:\code_space\streaming-chatbot\.planning\phases\01-foundation\01-RESEARCH.md (Section 13: tsconfig.json Verification)
  </read_first>

  <action>
    Read `tsconfig.json`. Verify (and if missing, add) the following two settings in `compilerOptions`:

    1. `"strict": true` — must be present and set to `true`
    2. `"paths": { "@/*": ["./src/*"] }` — must be present with this exact key and value

    create-next-app with `--src-dir` and `--import-alias "@/*"` generates both of these. If they are already present and correct, no edit is needed.

    If `"strict"` is missing, add it:
    ```json
    "strict": true,
    ```

    If `"paths"` is missing or has a different alias, set it to:
    ```json
    "paths": {
      "@/*": ["./src/*"]
    }
    ```

    Do NOT change any other tsconfig settings. The create-next-app defaults for `target`, `lib`, `module`, `moduleResolution`, etc. are correct for Next.js 16.

    After verifying, run `npx tsc --noEmit` from the project root to confirm TypeScript compiles without errors on the scaffold code.
  </action>

  <acceptance_criteria>
    - `tsconfig.json` contains `"strict": true`
    - `tsconfig.json` contains `"@/*"` in the paths section
    - `tsconfig.json` contains `"./src/*"` as the value for the `@/*` path alias
    - Running `npx tsc --noEmit` exits with code 0 (no TypeScript errors on the scaffold)
  </acceptance_criteria>
</task>

---

## Verification Criteria

After all tasks in this plan are complete:

1. **Package versions correct:**
   - `grep '"ai":' package.json` → shows `"ai": "6.0.137"`
   - `grep '"drizzle-orm":' package.json` → shows `"drizzle-orm": "0.45.1"`
   - `grep '"drizzle-kit":' package.json` → shows `"drizzle-kit": "0.31.10"`

2. **Scripts present:**
   - `grep 'db:generate' package.json` → returns a match

3. **Environment template present:**
   - `grep 'OPENAI_API_KEY' .env.local.example` → returns a match
   - `grep 'DATABASE_URL' .env.local.example` → returns a match

4. **TypeScript compiles:**
   - `npx tsc --noEmit` → exits 0

5. **No hardcoded credentials in source:**
   - `grep -r "sk-" src/` → returns zero results
   - `grep -r "postgresql://" src/` → returns zero results

6. **Dev server starts (INFRA-04 gate):**
   - With `OPENAI_API_KEY` and `DATABASE_URL` exported, `npm run dev` starts and the terminal shows `Ready in` without crashing
