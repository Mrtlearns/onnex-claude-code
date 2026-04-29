## Goals

1. **Fix the real OS-picker bug**: lessons 3–12 ignore the OS choice because their `body` is a single string. Make every lesson per-OS-aware in both data and UI, so swapping the OS toggle inside any lesson updates that lesson's content (without leaving the page).
2. **Fix the theme toggle "doesn't work on main page" bug** caused by `LessonIndex` and `OSToggle` using inverted-colour utilities that look identical in both modes.
3. **Add automated tests** that prove the theme `dark` class is applied across every main route and that `SiteHeader` renders the right shape per route.
4. **Ship in-app versioned docs**: an `/docs` route that renders the existing markdown docs from the repo, plus a top-nav link.
5. **Update `docs/README.md` and `CLAUDE.md`** to reflect the new per-OS model and the new `/docs` route.

---

## 1. Per-OS lesson model (the actual OS-picker fix)

Today `OSToggle` correctly calls `setOS(id)` without navigating, so the page stays put — but `LessonPage` calls `bodyFor(lesson.body, os)` and 10/12 lessons have `body: "string"`, so the OS selection is silently ignored. The "bug" is content shape, not navigation.

**Data-side change in `src/content/lessons.ts`:**
- Convert lessons 3–12 from `body: "..."` to `body: { mac, windows, linux }`.
- For each lesson, generate two minimally-differentiated variants from the existing macOS-flavoured copy:
  - **windows**: swap shell-ism examples (`brew` → `winget`/`scoop`, `~/.claude/CLAUDE.md` → `%USERPROFILE%\.claude\CLAUDE.md`, `which`/`zsh` → `where`/`PowerShell`, `chmod` notes removed, paths `/` → `\`). Keep all conceptual prose identical.
  - **linux**: keep most macOS prose verbatim but swap brew → `apt`/`curl`, mention `~/.bashrc`/`~/.zshrc`, drop macOS-specific keychain/Spotlight references.
  - Where a lesson has no OS-specific commands at all (e.g. *Wrapping Up*), the three variants are identical strings — having them as separate keys keeps the editor consistent and lets future overrides diverge per OS.
- Keep the `body: "..."` shape **legal** (`LessonBody = string | Partial<Record<OS,string>>`) so legacy drafts and the bulk editor's "shared body" path still work; nothing migrates implicitly.

**UI improvements:**
- `LessonPage`: add a small per-page `OSVariantNotice` ribbon when the lesson has multiple OS variants — "Showing macOS instructions · switch in the header". Use the existing OS toggle in `SiteHeader`; no second control on the page.
- The toggle already lives in `SiteHeader`, which already does **not** navigate, so changing OS on `/lessons/getting-ready` rerenders just the body via `useOS()`. We confirm this with a new render test.
- `LessonIndex` cards: small badge "macOS · Windows · Linux" or "All OS" indicating per-lesson coverage so editors can see at a glance which lessons are per-OS vs shared.

**Reference**: <https://claude-code.lovable.app/> uses an identical pattern — OS toggle persists, lesson stays, body swaps. Our `bodyFor()` already implements this correctly; it just needs data behind it.

## 2. Theme toggle visibility fix

The toggle already flips `<html class="dark">` correctly (verified by passing tests last loop). The reason "the theme toggle seems not to work on the main page" is that `LessonIndex` is wrapped in `bg-foreground text-background` — those tokens **swap** in dark mode, so the dark page stays dark and the light text stays light. The page genuinely doesn't change.

**Fix**:
- Replace the inverted scheme on `LessonIndex` with semantic tokens that **do** invert: outer wrapper becomes `bg-background text-foreground`; cards use `bg-card border-border text-card-foreground`; eyebrow text uses `text-muted-foreground`. Visual hierarchy is preserved (cards lift off the surface) and the page now has a real light + dark appearance.
- `OSToggle`: replace any inverted classes with `bg-card border-border` so the chip is visible in both modes (it already mostly is, but audit the active/inactive tokens).
- `SiteHeader` minimal home variant: visually verify it reads correctly on the light cream OS-picker background in both modes.

This is a **token-level visual change**, not a behavioural one — the toggle was working, but had nothing to toggle on the lesson index.

## 3. Automated tests

Add a single new render test that exercises every main route inside one provider tree and asserts the `<html>` `dark` class flips on each.

**New `src/components/__tests__/themeRoutes.test.tsx`:**
- Render the full app with `MemoryRouter` `initialEntries` set to one of `/`, `/lessons`, `/lessons/getting-ready`, `/admin`, `/docs`. For each:
  - Stub OS to `mac` via `localStorage.setItem("vci.os","mac")` before mount so route guards don't redirect.
  - Find the theme toggle by aria-label, click until `dark` class is set, assert. Cycle again and assert removal.
- Sanity asserts: `SiteHeader` renders the slim variant on `/` (no OSToggle, no Admin pill) and the full variant on `/lessons`, `/lessons/:slug`, `/admin`, `/docs`.

**New `src/components/__tests__/LessonPage.osSwap.test.tsx`:**
- Render `/lessons/getting-ready` with OS preset to `mac`, assert macOS marker phrase is in the rendered DOM (`macOS 13.0` etc.).
- Click the Windows chip in the OS toggle; assert the URL is unchanged and the body now contains a Windows marker phrase, not the macOS one.

**Update `src/components/__tests__/SiteHeader.test.tsx`** with a new case for the `/docs` route once the route exists.

Run `bunx vitest run` after — fix any breakage. All existing 29 tests must continue to pass.

## 4. In-app `/docs` page

Goal: docs are already versioned in the repo under `docs/`. We surface them inside the app so editors and visitors can find them without leaving the product.

- New page `src/pages/Docs.tsx` and component `src/components/DocsPage.tsx`.
- Use Vite's `?raw` import to bundle the markdown at build time:
  ```ts
  import readme from "../../docs/README.md?raw";
  import schema from "../../docs/SUPABASE_SCHEMA.md?raw";
  import testPlan from "../../docs/TEST_PLAN.md?raw";
  import claudeMd from "../../CLAUDE.md?raw";
  ```
  This keeps the docs single-sourced — change the `.md` file, the in-app page changes too.
- Layout: left rail with section list (`README`, `CLAUDE`, `Test Plan`, `Supabase Schema`) and `slug` query param (`/docs?d=readme`). Right pane renders with `react-markdown` + `remark-gfm` reusing the same prose styles as `LessonPage`.
- New route `<Route path="/docs" element={<Docs />} />` in `App.tsx`. Public — no auth.
- Add a "Docs" link to `SiteHeader` (in the full variant only).
- A footer line in each rendered doc shows the source path so users know where to edit (`docs/README.md`).

## 5. Doc updates

- `docs/README.md`: add §"Per-OS lesson bodies" describing the `LessonBody` shape and how the toggle drives `bodyFor`. Add §"In-app docs (`/docs`)" describing the `?raw` import wiring and how to add a new doc (drop the file, register it in `DocsPage.tsx`).
- `CLAUDE.md`: add to the "Where to find what" table (`In-app docs page` → `src/components/DocsPage.tsx`); add a new convention "Lesson bodies should be per-OS — strings allowed but discouraged for new lessons".
- `docs/TEST_PLAN.md`: add the two new automated test files and a manual smoke step "switch OS inside a lesson — body changes, route does not".

---

## Files

**New**
- `src/pages/Docs.tsx`
- `src/components/DocsPage.tsx`
- `src/components/__tests__/themeRoutes.test.tsx`
- `src/components/__tests__/LessonPage.osSwap.test.tsx`

**Edited**
- `src/content/lessons.ts` — lessons 3–12 converted to per-OS bodies.
- `src/components/LessonIndex.tsx` — semantic tokens that invert in dark mode; per-lesson OS-coverage badge.
- `src/components/LessonPage.tsx` — add small `OSVariantNotice` when body has multiple OS keys.
- `src/components/OSToggle.tsx` — token audit for dark mode visibility.
- `src/components/SiteHeader.tsx` — add Docs link in full variant.
- `src/components/__tests__/SiteHeader.test.tsx` — add `/docs` route case.
- `src/App.tsx` — register `/docs` route.
- `docs/README.md` — per-OS section, in-app docs section.
- `docs/TEST_PLAN.md` — new test entries + new manual step.
- `CLAUDE.md` — table + convention update.

## Notes / trade-offs

- We keep `LessonBody = string | Partial<Record<OS,string>>` so existing string-only drafts and the bulk-shared-body editor flow still work. The per-OS migration is data-only for the seed; admins can still author with a single body when content doesn't differ.
- The Windows/Linux variants we generate diverge minimally — only OS-specific commands and paths change. We don't invent new content; conceptual prose stays identical, which is honest and easy to maintain.
- `?raw` markdown imports keep `docs/` as the single source of truth for documentation. No duplication, no drift.
- We are **not** persisting per-OS preview to the URL on `LessonPage` because the OS toggle already updates global state; deep-linking with `?os=` is out of scope here.
