# CLAUDE.md — Pickup brief for Claude Code

> If you are an AI agent (or a new human contributor) opening this repo for the
> first time, read this file end-to-end before touching code. It is the fastest
> path from zero to a useful contribution.

## What this project is

**On-Nex Training Portal** — a static React/Vite SPA hosting a 12-lesson
Claude Code workshop. OS-aware lesson rendering, in-browser admin editor with
autosave, version history, asset uploads, and a publish flow — all
client-side. No auth, no backend (yet).

Live preview: <https://onnex-claude-code.lovable.app>

For the full architecture and feature inventory, read **[`docs/README.md`](./docs/README.md) first**.
For the planned backend, read **[`docs/SUPABASE_SCHEMA.md`](./docs/SUPABASE_SCHEMA.md)**.
For the QA gate, read **[`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md)**.

## Tech stack (pinned, do not swap)

- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS v3 with `darkMode: ["class"]`
- shadcn/ui components (in `src/components/ui/`) — customise via variants, do not fork
- `react-router-dom` v6
- `react-markdown` + `remark-gfm` for lesson bodies
- `@tanstack/react-query` (currently mostly idle — kept for future Supabase phase)
- Test runner: `vitest` + `@testing-library/react` + `fake-indexeddb`

This project ships on Lovable. Do **not** add Next.js, Vue, Angular, or a
custom server. Use Lovable Cloud (Supabase under the hood) when you need a backend.

## Where to find what

| You want to… | Open |
|---|---|
| Add or rephrase a lesson | `src/content/lessons.ts` |
| Change the brand name | `src/lib/brand.ts` (then nothing else) |
| Wire a new admin feature | `src/components/AdminEditor.tsx` + a new tab |
| Touch the markdown editor (paste, drop, image embed) | `src/components/MarkdownEditor.tsx` + `src/lib/imageStore.ts` |
| Adjust autosave / unsaved-change guard | `src/hooks/useDebouncedEffect.ts`, `useUnsavedChangesPrompt.ts` |
| Add a new draft snapshot kind | `src/lib/draftHistory.ts` |
| Log a new admin action | `src/lib/activityLog.ts` |
| Add to the unused-asset scan | `src/lib/assetUsage.ts` |
| Tweak theme colours | `src/index.css` (HSL tokens, both `:root` and `.dark`) |
| Change routes | `src/App.tsx` |
| Edit the in-app docs viewer | `src/pages/Docs.tsx` + `src/components/DocsPage.tsx` (markdown imported via `?raw`) |
| Add per-OS variants to a lesson | `src/content/lessons.ts` — body becomes `{ mac, windows, linux }` |

## Conventions (don't break these)

1. **Semantic Tailwind tokens only.** Never write `text-white`, `bg-black`, `bg-[#fff]`, or any raw colour class in components. Use `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-accent`, etc. New tokens go in `src/index.css` (HSL!) and `tailwind.config.ts`.
2. **HSL only in `index.css`.** Tailwind uses `hsl(var(--token))` everywhere; raw hex in tokens will silently break.
3. **Two-layer content model.** Editing flows: `default → published → draft`. Never write a third layer; never short-circuit `useLessons` / `useDraftLessons`.
4. **`vci.*` storage keys are legacy on purpose.** Do not rename them — that would erase every editor's saved drafts, history, and uploads. Comment in `src/lib/brand.ts` explains why.
5. **Asset URL scheme: `lov-img://<id>`.** The id is a UUID stored in IndexedDB (`vci-assets`). Resolution happens in `useResolvedMarkdown`, not at write-time. If you change this scheme, update `assetUsage.ts` regex too.
6. **No `console.log` in committed code.** Use the toast system (`@/hooks/use-toast`) for user-visible feedback.
7. **Roles, when added, never live on the profile.** See `docs/SUPABASE_SCHEMA.md` § Roles. Privilege escalation via profile-stored roles is a known footgun.
8. **Brand strings come from `BRAND` in `src/lib/brand.ts`.** Don't hardcode "On-Nex Training Portal" in JSX.
9. **Per-OS lesson bodies live as `{ mac, windows, linux }` in `lessons.ts`.** To add a new OS variant, extend the `OS` union in `src/context/OSContext.tsx`, then add the key to each lesson body and to `osCoverage()` in `LessonIndex.tsx`. Plain-string bodies are still allowed and treated as "all OS."
10. **Lesson resolution happens via `bodyFor(lesson.body, os)`.** Never read `lesson.body` directly in a renderer.

## Testing

```bash
bun install
bunx vitest run              # full suite
bunx vitest run src/lib      # focused
bunx vitest                  # watch mode
```

When you add a feature touching a `lib/` module, add a unit test next to it in
`__tests__/`. When you add a UI affordance to `SiteHeader` / `OSPicker` /
admin tabs, add a render test. The test setup file (`src/test/setup.ts`) wires
`fake-indexeddb`, a `matchMedia` stub, and clears storage between tests.

## Roadmap

The current biggest gap is **the lack of a real backend**. Everything in the
admin flow exists in the browser only. The full migration spec — table DDL,
RLS policies, edge functions, role model, storage buckets — lives in
**[`docs/SUPABASE_SCHEMA.md`](./docs/SUPABASE_SCHEMA.md)**.

After backend:
1. Wire authentication (email + Google via Lovable Cloud managed providers).
2. Replace `localStorage` calls in `contentStore.ts`, `activityLog.ts`, `draftHistory.ts` with Supabase queries (keep the same React hook signatures so consumers don't change).
3. Replace `imageStore.ts` IndexedDB blobs with Supabase Storage in the `lesson-assets` bucket; `lov-img://<id>` becomes `lov-img://<storage-path>` resolved against `getPublicUrl`.
4. Move publish/restore/delete-asset into edge functions for transactional safety + audit logging.
5. Gate `/admin` behind `has_role(auth.uid(), 'admin' | 'editor')`.

## Don't do

- Don't store roles on `profiles`. Use `user_roles` + `has_role()` SECURITY DEFINER. (Privilege escalation.)
- Don't add backend code (Python, Node servers) to the repo. Use Lovable Cloud edge functions.
- Don't break the `vci.*` storage prefix. Migrate state, don't drop it.
- Don't write custom colour classes (see Conventions §1).
- Don't introduce another markdown library — `react-markdown` + `remark-gfm` is the standard here.
- Don't mark `/admin` as "secured" until the backend phase ships. It is openly accessible by design right now.

## When in doubt

Read `docs/README.md`. If the answer isn't there, it probably isn't a project
convention yet — make a defensible call and add a note to `docs/README.md` so
the next person doesn't re-litigate it.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
