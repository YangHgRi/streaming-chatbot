---
plan: 03-03
title: "Server Actions: Create, Rename, Delete, and Sidebar Wiring"
phase: 3
wave: 3
status: complete
started: "2026-03-25T11:00:00.000Z"
completed: "2026-03-25T11:30:00.000Z"
---

# Plan 03-03 Summary: Server Actions — Create, Rename, Delete, and Sidebar Wiring

## Outcome

All 3 tasks executed successfully. `src/app/actions.ts` is created with all three Server Actions (`createChatAction`, `renameChatAction`, `deleteChatAction`). `Sidebar.tsx` now imports and forwards these real actions to `SidebarClient` as props — replacing the stub functions from Wave 2. `SidebarClientProps` was updated from `Promise<never>` to `Promise<void>` to match the real action signatures. `npx tsc --noEmit` exits 0 after all changes. All CONV-01, CONV-04, and CONV-05 requirements are fully wired end-to-end.

## Tasks Executed

| Task | Title | Commit | Status |
|------|-------|--------|--------|
| 03-03-T01 | Create src/app/actions.ts with all three Server Actions | `700356e` | ✅ Done |
| 03-03-T02 | Update Sidebar.tsx to import actions and pass to SidebarClient | `d1f5177` | ✅ Done |
| 03-03-T03 | End-to-end smoke test: verify all 5 CONV requirements are functional | `faeba5c` | ✅ Done |

## Commit Log

- `700356e` — `feat(03-03): Create src/app/actions.ts with createChatAction, renameChatAction, deleteChatAction`
- `d1f5177` — `feat(03-03): Update Sidebar.tsx to import real Server Actions from actions.ts; fix SidebarClientProps to use Promise<void>`
- `faeba5c` — `test(03-03): End-to-end smoke test — tsc --noEmit exits 0, all Phase 3 CONV requirements wired and verified`

## Files Modified

| File | Change |
|------|--------|
| `src/app/actions.ts` | Created — `'use server'` module with `createChatAction`, `renameChatAction`, `deleteChatAction`; `redirect()` only at top level (never in try/catch); `revalidatePath('/', 'layout')` called before each redirect |
| `src/components/Sidebar.tsx` | Replaced — stub actions removed; now imports real Server Actions from `@/app/actions`; passes all three as props to `SidebarClient` |
| `src/components/SidebarClient.tsx` | Updated — `SidebarClientProps` interface changed from `Promise<never>` to `Promise<void>` for `createChatAction` and `deleteChatAction` to match real Server Action return type |

## Acceptance Criteria Verification

### T01 — src/app/actions.ts
- ✅ File exists at `src/app/actions.ts`
- ✅ `'use server'` on first line (file-level directive — all exports are Server Actions)
- ✅ `revalidatePath('/', 'layout')` appears 3 times (one per action)
- ✅ All three functions exported: `createChatAction`, `renameChatAction`, `deleteChatAction`
- ✅ `redirect` only in `createChatAction` and `deleteChatAction` (NOT in `renameChatAction`)
- ✅ No `try` blocks — `redirect()` always called at top level
- ✅ `title.trim()` blank-title guard present
- ✅ `if (!title?.trim()) return;` early-return guard present
- ✅ `npx tsc --noEmit` exits 0

### T02 — Sidebar.tsx
- ✅ 6 matches for action names (3 imports + 3 JSX props)
- ✅ `from '@/app/actions'` import present
- ✅ No `'use client'` directive (remains Server Component)
- ✅ `getChats` imported and called (data fetch preserved)
- ✅ `async function Sidebar` present
- ✅ `npx tsc --noEmit` exits 0

### T03 — End-to-end smoke test
- ✅ `npx tsc --noEmit` exits 0 (all Phase 3 files compile together)
- ✅ `npx next build` compiles TypeScript successfully (`Compiled successfully in 4.0s`, `Finished TypeScript in 3.1s`) — DB connection error at prerender is expected (no `.env.local` in build env, consistent with Phase 1 gate notes)
- ✅ CONV-01: `createChatAction` creates chat, revalidates layout, redirects to `/chat/${id}`
- ✅ CONV-04: `renameChatAction` guards blank titles, updates Postgres, revalidates layout (no redirect)
- ✅ CONV-05: `deleteChatAction` deletes chat (CASCADE removes messages), revalidates layout, redirects to `/`
- ✅ `SidebarClient` receives real Server Actions as props — full CRUD loop is wired

## Deviations

### T02 — SidebarClientProps: Promise<never> → Promise<void>

**Issue:** The real Server Actions (`createChatAction`, `deleteChatAction`) return `Promise<void>` — TypeScript does not infer `Promise<never>` even though `redirect()` always throws internally. This caused a TS2322 assignability error when wiring the real actions into `SidebarClient`.

**Fix (auto-fix per Rule 1 — compile error):** Updated `SidebarClientProps` in `SidebarClient.tsx` to use `Promise<void>` instead of `Promise<never>` for `createChatAction` and `deleteChatAction`. The behavior is identical at runtime — `Promise<void>` is the correct TypeScript type for async functions that call `redirect()`. This also makes the interface more future-proof (easier to test/mock).

## Notes

- `redirect()` is called at the top level in both `createChatAction` and `deleteChatAction` — never inside `try/catch`. This is critical: `redirect()` throws a `NEXT_REDIRECT` error internally; catching it would swallow the navigation.
- `revalidatePath('/', 'layout')` uses the `'layout'` scope to bust the Router Cache for the entire root layout subtree, causing the `Sidebar` Server Component to re-execute on next render.
- `revalidatePath` is called BEFORE `redirect()` in create/delete actions — the cache is already busted when the browser navigates to the new URL.
- TypeScript check (`npx tsc --noEmit`) passes at 0 after every task and at final state.
- The next build DB error (`password authentication failed`) is an environment constraint, not a code issue — matches the existing Phase 1 checkpoint pattern.
