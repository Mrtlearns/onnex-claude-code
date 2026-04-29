# Finish the per-OS / theme / docs loop

The structural work from the previous request is already in place:

- **Per-OS rendering for lessons 3–12** — every lesson in `src/content/lessons.ts` is already `{ mac, windows, linux }`, `LessonPage.tsx` resolves via `bodyFor(lesson.body, os)` and shows the OS-variant ribbon when `Object.values(body).filter(Boolean).length > 1`. Switching the OSToggle in the header re-renders in place (no navigation).
- **Non-inverted Tailwind tokens** — `LessonIndex.tsx`, `OSToggle.tsx`, `OSPicker.tsx`, `LessonPage.tsx`, and `DocsPage.tsx` are all on semantic tokens (`bg-background`, `bg-card`, `bg-accent-soft`, `text-foreground`, etc.). No `bg-foreground text-background` inversions remain in any main route.
- **/docs route** — `src/pages/Docs.tsx` + `src/components/DocsPage.tsx` already render `docs/README.md`, `docs/TEST_PLAN.md`, `docs/SUPABASE_SCHEMA.md`, and `CLAUDE.md` via Vite `?raw` imports, with a sidebar selector and shareable `?d=` query. `SiteHeader.tsx` exposes the **Docs** link on the full-header routes.

What still needs to ship to close the loop:

## 1. Fix the racing OS-swap test

`src/components/__tests__/LessonPage.osSwap.test.tsx` — the second assertion (`expect(screen.queryByText(/macOS 13\.0 \(Ventura\)/i)).toBeNull()`) races the async `useResolvedMarkdown` effect.

Replace the brittle "absence" check with a `waitForElementToBeRemoved` that also tolerates the "Choosing Your Windows Path" marker becoming the source of truth:

```ts
import { waitForElementToBeRemoved } from "@testing-library/react";
// …after clicking Win:
await screen.findByText(/Choosing Your Windows Path/i);
await waitForElementToBeRemoved(() => screen.queryByText(/macOS 13\.0 \(Ventura\)/i));
```

This cleanly waits for the markdown resolver promise instead of polling once.

## 2. Documentation refresh (small, surgical)

- **`docs/README.md`** — add a short "Per-OS lesson model" subsection under *Content model* explaining `LessonBody = string | Partial<Record<OS, string>>`, that all 13 lessons currently provide all three OS variants, and that `LessonPage` shows the variant ribbon only when >1 variant is populated.
- **`docs/README.md`** — add a "/docs route" subsection under *Routes* describing the build-time `?raw` markdown imports and the `?d=<slug>` deep link.
- **`CLAUDE.md`** — add the `/docs` route to the "Where to find what" table and a one-liner under Conventions: *"Per-OS lesson bodies live as `{ mac, windows, linux }` in `lessons.ts`. To add a new OS variant, extend the `OS` union in `src/context/OSContext.tsx`, then add the key to each lesson body."*
- **`docs/TEST_PLAN.md`** — add two checklist items: (a) "Theme toggle visibly changes styles on `/`, `/lessons`, `/lessons/:slug`, `/admin`, `/docs`"; (b) "Switching OS on a lesson page replaces the body without navigating away and shows the OS-variant ribbon."

## 3. Verification

Run `bunx vitest run` and confirm all suites are green. Spot-check the preview on `/`, `/lessons`, `/lessons/getting-ready`, `/admin`, `/docs` to confirm the dark toggle visibly changes background and text colors on each.

## Files touched

- `src/components/__tests__/LessonPage.osSwap.test.tsx` — replace the racy assertion with `waitForElementToBeRemoved`.
- `docs/README.md` — two short subsections (per-OS model, /docs route).
- `CLAUDE.md` — add /docs row + per-OS one-liner.
- `docs/TEST_PLAN.md` — two checklist additions.

No source-code changes to components, content, or routing are needed — those were completed in the prior loop and verified during exploration.
