## Goals

1. Rebrand "Vibe Coding Incubator" → "On-Nex Training Portal" everywhere user-visible.
2. Make the light/dark theme toggle actually work, including on the OS-picker home page.
3. Run a comprehensive smoke + unit test pass and fix what breaks.
4. Write three new docs: app overview (`docs/README.md`), `CLAUDE.md` (project handover for Claude Code), `docs/SUPABASE_SCHEMA.md` (full backend build spec with role-based access).

---

## 1. Rebrand to "On-Nex Training Portal"

**User-visible strings (replace):**
- `index.html` → `<title>`, `<meta name="author">`, OG/Twitter titles → "Claude Code Workshop — On-Nex Training Portal"
- `src/components/OSPicker.tsx` line 24 → "ON-NEX TRAINING PORTAL"
- `src/components/LessonIndex.tsx` line 27 → "On-Nex Training Portal"
- `src/content/lessons.ts` body copy: replace "Vibe Coding Incubator" / "incubator" greetings with "On-Nex Training Portal" wording. Phrases like "vibe coding", "vibe checks", "vibes", "Groundhog Day" stay — they're stylistic, not branding. Only the explicit product-name mentions change.

**Internal storage keys (leave alone):** `vci.*` localStorage keys and `vci-assets` IndexedDB name are not user-visible. Renaming them would discard every admin's saved drafts, history, and uploads. They get a one-line comment explaining the legacy prefix and we move on.

**Add a single brand constant** at `src/lib/brand.ts`:
```ts
export const BRAND = { name: "On-Nex Training Portal", short: "On-Nex" } as const;
```
Components that show the name import from this constant so future renames are one-file changes.

## 2. Theme system that actually works

Currently `SiteHeader.tsx` has a `<Sun>` icon button with no handler, and the header is hidden entirely when `!os` (so the home page can never toggle). Tailwind is already configured `darkMode: ["class"]` and `.dark` tokens exist in `index.css` — we just need a provider that toggles a class on `<html>`.

**New `src/context/ThemeContext.tsx`:**
- `theme: "light" | "dark" | "system"`, persisted to `localStorage` key `vci.theme`.
- Resolves `system` against `matchMedia("(prefers-color-scheme: dark)")` and reacts to changes.
- Applies `.dark` to `document.documentElement` whenever the resolved theme is dark.
- Initialiser script in `index.html` `<head>` that sets the class **before** React mounts to prevent flash of light theme.

**Wire the toggle:**
- `SiteHeader`: replace static `<Sun>` button with a real `ThemeToggle` (cycles light → dark → system, icon updates).
- Show `SiteHeader` (or at least a minimal top-right toggle) on the OS picker too. Cleanest fix: don't return `null` when `!os` — render only the brand mark + theme toggle, hide OS toggle/admin/search.
- Mount `<ThemeProvider>` in `App.tsx` above all routes.

## 3. Comprehensive test plan

Add `vitest` unit tests covering pure logic, plus a few rendering smoke tests. No e2e — out of scope for this stack.

**New test files:**
- `src/lib/__tests__/activityLog.test.ts` — log/cap-at-200/clear/subscribe.
- `src/lib/__tests__/draftHistory.test.ts` — pushSnapshot dedupe, 20-cap eviction, getHistory, clear.
- `src/lib/__tests__/assetUsage.test.ts` — scans drafts + published bodies, ignores defaults without overrides, correctly identifies orphans (mock `localStorage`).
- `src/content/__tests__/contentStore.test.ts` — setDraft/discardDraft/publishDraft (single + all), useLessons returns merged result, exportPublished/importPublished round-trip.
- `src/context/__tests__/ThemeContext.test.tsx` — toggling sets class on `documentElement`, persists to localStorage, system mode follows mql.
- `src/components/__tests__/SiteHeader.test.tsx` — renders theme toggle on home + lessons page.
- `src/components/__tests__/OSPicker.test.tsx` — renders new brand string, choosing OS calls `setOS` + navigates.

**Setup adjustments:**
- `src/test/setup.ts`: stub `matchMedia` (already there) plus `IndexedDB` polyfill via `fake-indexeddb/auto` import (add devDep) so imageStore tests can run.
- Add `localStorage` reset in a global `beforeEach` so tests don't bleed.

**Manual smoke checklist** (executed after fixes, documented in `docs/TEST_PLAN.md`):
- Home page → choose OS → lesson index loads with correct brand
- Theme toggle on home + lessons + admin all flip `<html class="dark">`
- Admin: edit lesson → autosave indicator → publish → activity log row appears → version-history dialog shows snapshot → restore works
- Bulk: same-body and per-slug-blocks both stage drafts
- Assets: upload image in editor → appears in Assets tab with "Used in 1" → delete unused works
- Per-OS lesson rendering matches selected OS

Run `lovable-exec test` (vitest). Fix any reds.

## 4. Documentation

**`docs/README.md`** — single source of truth for the project:
- One-paragraph elevator pitch (On-Nex Training Portal — Claude Code workshop, OS-aware lessons, no auth, browser-native admin).
- Architecture diagram (ASCII): React + Vite + React Router → contentStore (localStorage) + imageStore (IndexedDB).
- Directory map of `src/` with one-line purposes.
- Feature inventory: lesson rendering, OS toggle, cookie banner, admin editor (autosave, history, per-lesson + bulk publish, asset cleanup, activity log, version history), markdown editor with image/PDF upload.
- Source-content credits: rephrased from `docs.claude.com/claude-code` and `claude-code.lovable.app`.
- "How content flows" mini-diagram: default lessons.ts → published overlay → draft overlay → editor.
- Local dev commands and how to publish.
- Known limitations (no auth, browser-only persistence, history capped at 20/lesson, 200 activity events).

**`CLAUDE.md`** at repo root — pickup brief for Claude Code (or any new contributor):
- "Read me first" section with the project's purpose and current state.
- Tech stack pinning (React 18, Vite, TS, Tailwind v3, shadcn, react-markdown).
- Where to find what (table mapping concern → file).
- Conventions: semantic Tailwind tokens only (no raw colors), HSL in `index.css`, draft → publish two-layer model, `lov-img://` URL scheme.
- Testing: how to add and run tests.
- Roadmap: backend migration (point at `docs/SUPABASE_SCHEMA.md`), auth wiring, multi-user collab.
- "Don't do" list (don't break the storage key prefix, don't store roles on the profile table, don't write custom colour classes).

**`docs/SUPABASE_SCHEMA.md`** — complete backend build spec for when this graduates from localStorage:
- Goals: persist lesson overrides server-side, per-user drafts, multi-admin publishing, asset CDN, activity audit.
- Roles: `app_role` enum (`admin`, `editor`, `student`); separate `user_roles` table; `has_role()` SECURITY DEFINER function (per Lovable security guidance — never store roles on profiles).
- Tables (full DDL):
  - `profiles` — id (FK auth.users), display_name, avatar_url, created_at.
  - `user_roles` — id, user_id, role.
  - `lessons` — id, slug (unique), kind, number, icon, title, summary, body_default jsonb (per-OS map or string), order_index, created_at, updated_at.
  - `lesson_drafts` — id, lesson_id FK, author_id FK, title, summary, body jsonb, updated_at; unique(lesson_id, author_id).
  - `lesson_published` — id, lesson_id FK unique, title, summary, body jsonb, published_by, published_at.
  - `lesson_snapshots` — id, lesson_id, author_id, title, summary, body jsonb, kind enum('autosave','published','restore'), created_at; capped via trigger to 20 per (lesson, author).
  - `activity_log` — id, actor_id, action enum('publish_single','publish_all','restore','delete_asset'), lesson_id null, title_snapshot, body_preview, created_at.
  - `assets` — id, owner_id, storage_path, name, mime_type, size_bytes, created_at; storage bucket `lesson-assets` (public read).
  - `asset_usage` — view derived from regex over `lesson_published.body || lesson_drafts.body` (or maintained via trigger).
- RLS policies for every table written out, all using `has_role(auth.uid(), 'admin'|'editor')` — no recursive policies. Students read `lesson_published` only.
- Storage policies for `lesson-assets` (admin/editor write, public read).
- Edge functions to add: `publish-draft`, `publish-all`, `restore-snapshot` (transactional + writes to activity_log + snapshots).
- Migration from localStorage: a one-shot `import-from-json` edge function consuming the existing "Export" JSON.
- Indexes, triggers (updated_at, snapshot capping), and seed script outline.

`CLAUDE.md` references `docs/SUPABASE_SCHEMA.md` as the canonical spec for the backend phase.

---

## Files

**New**
- `src/lib/brand.ts`
- `src/context/ThemeContext.tsx`
- `src/components/ThemeToggle.tsx`
- `src/lib/__tests__/activityLog.test.ts`
- `src/lib/__tests__/draftHistory.test.ts`
- `src/lib/__tests__/assetUsage.test.ts`
- `src/content/__tests__/contentStore.test.ts`
- `src/context/__tests__/ThemeContext.test.tsx`
- `src/components/__tests__/SiteHeader.test.tsx`
- `src/components/__tests__/OSPicker.test.tsx`
- `docs/README.md`
- `docs/TEST_PLAN.md`
- `docs/SUPABASE_SCHEMA.md`
- `CLAUDE.md`

**Edited**
- `index.html` — title/OG/meta + pre-mount theme script.
- `src/App.tsx` — wrap routes in `<ThemeProvider>`.
- `src/components/SiteHeader.tsx` — render minimal version on home; wire `ThemeToggle`.
- `src/components/OSPicker.tsx` — brand string from `BRAND.name`.
- `src/components/LessonIndex.tsx` — brand string.
- `src/content/lessons.ts` — replace explicit "Vibe Coding Incubator" mentions in body copy.
- `src/test/setup.ts` — add `fake-indexeddb/auto`, localStorage reset.
- `package.json` — add `fake-indexeddb` devDep.

## Notes / trade-offs

- Keeping the `vci.*` storage prefix is a deliberate compatibility choice — renaming would erase real user state with no upside. A code comment makes the legacy origin explicit.
- The OS picker page now renders a slim header just for the theme toggle, so the brand identity stays clean while fixing the bug.
- All new docs live under `docs/` except `CLAUDE.md`, which sits at the repo root because that's where Claude Code's convention expects it.
