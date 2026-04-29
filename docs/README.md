# On-Nex Training Portal

> **Claude Code Workshop** — A browser-native, OS-aware training portal that walks
> learners through installing, configuring, and getting productive with Anthropic's
> Claude Code agentic terminal tool.

This document is the **single source of truth** for the project: what it is, what's
in it, how content flows, and how to run / contribute / publish.

## Elevator pitch

The On-Nex Training Portal is a static React/Vite single-page app that hosts a
12-lesson Claude Code curriculum. Visitors pick their operating system on the
landing page, then read OS-tailored lessons (commands, file paths, and gotchas
swap based on the chosen OS). An in-browser admin mode lets a trusted editor
rewrite lessons, upload images/PDFs, autosave drafts, browse version history,
and publish — all without a backend.

Today everything persists in the browser (localStorage + IndexedDB). The
`docs/SUPABASE_SCHEMA.md` document is the build spec for promoting this to a
real multi-user backend with role-based access when the project graduates.

## Architecture

```text
                 ┌──────────────────────────────────────────┐
                 │            React 18 + Vite SPA            │
                 │                                           │
   visitor   ──▶ │  /          OSPicker                       │
                 │  /lessons   LessonIndex (reads useLessons) │
                 │  /lessons/* LessonPage (markdown render)   │
                 │  /admin     AdminEditor                    │
                 │                                           │
                 │  Providers: Theme · OS · Admin             │
                 └────────┬─────────────────────────┬────────┘
                          │                         │
                ┌─────────▼─────────┐   ┌───────────▼─────────────┐
                │ contentStore.ts   │   │ imageStore.ts           │
                │ localStorage      │   │ IndexedDB (vci-assets)  │
                │  vci.content.*    │   │  blobs + metadata       │
                │  vci.draft-history│   │                         │
                │  vci.activity.v1  │   └─────────────────────────┘
                │  vci.theme        │
                └───────────────────┘
                          │
                ┌─────────▼─────────┐
                │ src/content/      │
                │ lessons.ts        │  ← default content (rephrased
                │ (compiled in)     │     from Anthropic docs)
                └───────────────────┘
```

## Directory map

| Path | Purpose |
|------|---------|
| `src/pages/` | Route-level shells (Index, Lessons, LessonRoute, Admin, NotFound) |
| `src/components/` | UI building blocks: `OSPicker`, `LessonIndex`, `LessonPage`, `AdminEditor`, `MarkdownEditor`, `AssetManager`, `ActivityLog`, `VersionHistoryDialog`, `SiteHeader`, `ThemeToggle`, `CookieBanner`, `OSToggle`, shadcn `ui/` |
| `src/content/lessons.ts` | Default lesson catalogue (slug, kind, icon, title, summary, body — body can be a string or a `Record<OS, string>`) |
| `src/content/contentStore.ts` | Two-layer overlay store (PUBLISHED + DRAFT) with `useLessons` / `useDraftLessons` / `publishDraft` etc. |
| `src/context/OSContext.tsx` | Selected OS, persisted to `vci.os` |
| `src/context/AdminContext.tsx` | Whether admin mode is on, persisted to `vci.admin` |
| `src/context/ThemeContext.tsx` | `light \| dark \| system`, persisted to `vci.theme`, applies `.dark` class to `<html>` |
| `src/lib/imageStore.ts` | IndexedDB wrapper for uploaded images/PDFs; exposes `lov-img://<id>` URLs that `MarkdownEditor` rewrites at render time |
| `src/lib/activityLog.ts` | Append-only publish log capped at 200 entries (`vci.activity.v1`) |
| `src/lib/draftHistory.ts` | Per-lesson rolling 20-snapshot history (`vci.draft-history.v1`) |
| `src/lib/assetUsage.ts` | Scans draft + published bodies for `lov-img://` references — drives the unused-asset cleanup screen |
| `src/lib/brand.ts` | `BRAND.name = "On-Nex Training Portal"` — single rename point |
| `src/hooks/` | `useDebouncedEffect`, `useHistory`, `useResolvedMarkdown`, `useUnsavedChangesPrompt` |
| `src/test/setup.ts` | Vitest setup: jest-dom, fake-indexeddb, matchMedia stub, storage reset |
| `index.html` | Includes a pre-mount theme initialiser script to avoid theme flash |
| `tailwind.config.ts`, `src/index.css` | HSL semantic tokens, `darkMode: ["class"]` |

## How content flows

```text
src/content/lessons.ts  (default)
        │
        ▼
   PUBLISHED overlay  (vci.content.published.v1)   ← what visitors see
        │
        ▼
   DRAFT overlay      (vci.content.draft.v1)       ← what admin edits
        │
        ▼
   AdminEditor view   (useDraftLessons)
```

- `useLessons()` returns default + published.
- `useDraftLessons()` returns default + published + draft.
- `publishDraft(slug?)` promotes one slug or all drafts to the published layer.
- Every successful publish writes an `ActivityEntry` and a "publishedMarker" snapshot to `draftHistory`.

## Feature inventory

- **OS-aware rendering** — `bodyFor(body, os)` resolves a `Record<OS, string>` body to the active OS's string; plain-string bodies are returned as-is.
- **Theme switching** — `ThemeProvider` cycles `light → dark → system`, persists, and reacts to OS-level changes when `system`. Pre-mount script in `index.html` prevents the wrong-theme flash.
- **Cookie banner** — `CookieBanner` (analytics opt-in placeholder, `vci.cookie`).
- **Admin editor** — Four tabs:
  - **Editor** — Markdown editor with autosave (`useDebouncedEffect`), undo/redo (`useHistory`), unsaved-change guard (`useUnsavedChangesPrompt`), per-lesson Publish.
  - **Bulk** — Stage drafts across many lessons via shared body or per-slug blocks; Publish All.
  - **Assets** — Lists every uploaded asset with usage counts; deletes unreferenced files safely.
  - **History** — Per-lesson dialog showing the last 20 snapshots; click to preview, click to restore.
- **Activity log** — `ActivityLog` component shows the last 200 publish events (single + batch) with timestamp, title snapshot, and body preview.
- **Asset uploads** — `MarkdownEditor` accepts pasted/dragged images and PDFs; stores them in IndexedDB as blobs and embeds them as `lov-img://<id>` URLs that get resolved at render time.

### Per-OS lesson model

Lesson bodies are typed as `LessonBody = string | Partial<Record<OS, string>>`,
where `OS = "mac" | "windows" | "linux"`. As of this revision, **all 13
lessons** (the pre-work plus lessons 1–12) ship with all three OS variants
populated.

`LessonPage` resolves the active variant via `bodyFor(lesson.body, os)` and
renders an OS-variant ribbon (`data-testid="os-variant-notice"`) only when the
body has more than one populated variant. Switching the OS toggle in the
header updates the body in place — the route does not change, so deep links
to `/lessons/<slug>` always survive an OS switch.

To add a new OS:

1. Extend the `OS` union in `src/context/OSContext.tsx` and update `OS_LABELS`/`OS_SHORT`.
2. Add the new key to each lesson body in `src/content/lessons.ts`.
3. Update `osCoverage()` in `src/components/LessonIndex.tsx` so the coverage chip stays accurate.

### `/docs` route

`src/pages/Docs.tsx` mounts `DocsPage`, which imports the repository's
markdown files (`docs/README.md`, `docs/TEST_PLAN.md`,
`docs/SUPABASE_SCHEMA.md`, `CLAUDE.md`) at build time using Vite's `?raw`
suffix. The sidebar selects between docs; the URL carries the active doc as
`?d=<slug>` so links are shareable. Because the markdown is imported (not
fetched), the docs page can never drift from the repo — every release ships
the docs that match its source.

## Source content credits

Lesson bodies were rephrased (not copied verbatim) from:

- <https://docs.claude.com/claude-code> — Anthropic's official Claude Code documentation.
- <https://claude-code.lovable.app/> — community starter portal we used as a structural reference.

Style/tone words like "vibe coding" and "vibe checks" are stylistic choices, not source attribution.

## Local development

```bash
bun install          # install deps
bun run dev          # vite dev server
bunx vitest run      # run unit tests
```

To enter admin mode: open the app, click **Admin** in the top-right. To exit:
click the orange **Exit Admin** pill.

## Publishing

The app deploys as a static SPA via Lovable. Every editor change is local-only
until **Publish** is clicked, at which point the draft overlay is promoted into
the published overlay (still client-side). For true multi-user publishing,
implement the backend in `docs/SUPABASE_SCHEMA.md`.

## Known limitations

- **No auth.** Admin mode is just a localStorage flag — anyone visiting `/admin` can edit. Acceptable for prototype/internal use; do not expose on public hosting without the Supabase migration.
- **Browser-only persistence.** Clearing site data wipes drafts, history, uploads, and overrides.
- **History cap:** 20 snapshots per lesson, 200 total publish events.
- **No collaboration.** Two admins editing in different browsers will overwrite each other on publish.
- **Image storage** lives in IndexedDB — large PDFs will eat browser quota fast.

See `docs/TEST_PLAN.md` for the manual smoke checklist run against every release.
