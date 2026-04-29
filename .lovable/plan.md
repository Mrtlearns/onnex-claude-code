# Admin editor: autosave, per-lesson publish, image uploads

Three changes to the existing admin editor. Image uploads are largely already wired up — this plan finishes the loop and adds visible affordances.

## 1. Autosave of draft edits

Today, edits in the Single editor only hit the draft store when you press **Save draft**. If you refresh or click away the in-memory working copy is lost.

Change: every edit (title / summary / body / per-OS bodies) is auto-staged into the **Draft layer** after a short idle delay. The Draft layer already persists to `localStorage`, so a refresh restores your work; the Published layer is untouched until you press **Publish**.

- New hook `src/hooks/useDebouncedEffect.ts` (tiny: runs an effect after `delay` ms of idle).
- In `SingleEditor`, a single debounced effect (~800 ms) watches `title.value`, `summary.value`, `mode`, and the four body buffers, then calls `setDraft(slug, { title, summary, body })` with the assembled `LessonBody`.
- Skip the autosave on the first render after a lesson change (so opening a clean lesson doesn't write a no-op draft entry that lights up the "pending" pill).
- Status line above the editor changes its three states:
  - `Saving…` while the debounce is pending or in flight
  - `Saved · just now` (relative time, ticks every 30 s) once the latest change is in the draft store
  - `All changes published` when there's no draft for this slug
- Keep the existing **Save draft** button as a manual flush (useful right before Publish, no behavior change), but it stops being the only thing that persists.
- The dirty-vs-published warning (`useUnsavedChangesPrompt` + the in-app confirm when switching lessons) gets recomputed against the **published** layer instead of the draft+published merge, so it only fires when there are unpublished changes — which is now ~always true while editing. We'll reuse the existing `pendingSlugs.has(lesson.slug)` signal for that, and drop the per-keystroke "unsaved" badge in favor of the autosave status above.

Bulk editor stays explicit (Stage as drafts → Publish) — autosave there would be surprising.

## 2. Per-lesson Publish button

Two surfaces:

**a. Inside the Single editor toolbar** (already exists, needs a small fix): the current "Publish" button calls `handleSaveDraft()` then `publishDraft(slug)` unconditionally. With autosave in place, drop the manual save call — `publishDraft(slug)` reads from the draft store directly. Disable the button when `!pendingSlugs.has(lesson.slug)` (nothing to publish for this lesson).

**b. Inline in the lesson list** (new): each row in `LessonList` that has a pending draft gets a small **Publish** icon-button (rocket, ghost, h-6) next to the orange dot. Clicking it shows a tiny confirm (`AlertDialog`, "Publish '<title>'?") then calls `publishDraft(slug)`. This lets you promote one lesson without leaving whatever lesson you're currently editing.

**c. Toolbar rename**: the existing "Publish all" stays, just always visible (currently hidden when `pendingCount <= 1`); shown disabled when `pendingCount === 0`. Makes the mental model consistent: per-lesson publish in the list, publish-everything in the top bar.

## 3. Image / file uploads (verify + polish)

The pipeline already exists end-to-end:

- `src/lib/imageStore.ts` — IndexedDB store, `saveImage(file)` returns `lov-img://<id>`.
- `src/components/MarkdownEditor.tsx` — toolbar **Insert image** button (file picker), plus paste-image and drag-and-drop handlers, all routing through `saveImage`.
- `src/hooks/useResolvedMarkdown.ts` — swaps `lov-img://` refs for blob URLs at render time.
- `src/components/LessonPage.tsx` already uses `useResolvedMarkdown`, so uploaded images render on the public lesson too.

What I'll change:

- **File-type widening**: today the picker only accepts `image/*`. Widen `accept` to `image/*,application/pdf` and let `saveImage` accept any file; non-image files get inserted as a Markdown link `[filename.pdf](lov-img://...)` rather than `![]()`. Detection by MIME prefix in `MarkdownEditor.handleFiles`.
- **Upload progress / errors**: wrap each upload in a `try/catch`, toast on failure ("Upload failed: <name>"). Show a small spinner badge on the toolbar's image button while uploading.
- **Storage caveat surfaced in UI**: short helper text under the editor — "Images are stored in this browser only. Use Export to back them up." (We'll skip building image export today; that's a separate feature.)
- **Quick sanity checks in the preview pane**: confirm the preview's `useResolvedMarkdown` resolves freshly-uploaded ids without a remount (it should, because `md` changes → effect re-runs).

## Files

**New**
- `src/hooks/useDebouncedEffect.ts`

**Modified**
- `src/components/AdminEditor.tsx` — autosave wiring, per-row Publish in `LessonList`, toolbar tweaks, status text
- `src/components/MarkdownEditor.tsx` — widen accept, link vs image insert, upload error handling

**Unchanged but verified**
- `src/lib/imageStore.ts`, `src/hooks/useResolvedMarkdown.ts`, `src/content/contentStore.ts`, `src/components/LessonPage.tsx`

## Out of scope
- Auth on `/admin` (still open, per earlier decision).
- Cross-device sync of drafts/images (still browser-local; Lovable Cloud migration remains a one-shot follow-up if/when you want it).
- Bulk-editor autosave.
