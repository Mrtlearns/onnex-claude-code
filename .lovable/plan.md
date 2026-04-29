# Admin Editor v2

## A note on SQLite

This project is a Vite + React browser app with no Node server, so a real SQLite file isn't available. Closest equivalents in the browser:

- **IndexedDB** — native, ideal for binary blobs like images. I'll use this for image storage.
- **localStorage** — already used for content overrides; I'll keep using it for JSON drafts/published.

If you later want a real SQL database (and image hosting that survives across browsers/devices), the right move is to enable Lovable Cloud (Postgres + Storage). Migration from this implementation is straightforward — only two modules (`contentStore.ts`, `imageStore.ts`) need to be swapped.

## What gets built

### 1. Two-layer content store (Draft + Published)
Refactor `src/content/contentStore.ts`:
- **Published layer** (`vci.content.published.v1`): what visitors see on `/lessons` and `/lessons/:slug`.
- **Draft layer** (`vci.content.draft.v1`): what the admin edits.
- `useLessons()` reads Published; `useDraftLessons()` reads Draft-on-top-of-Published.
- New actions: `setDraft`, `setManyDrafts`, `discardDraft`, `discardAllDrafts`, `publishDraft(slug?)`, `usePendingSlugs()`.

### 2. Image uploads (IndexedDB)
New `src/lib/imageStore.ts`:
- Saves files as Blobs under a generated id; returns a `lov-img://<id>` URL written into Markdown.
- New hook `useResolvedMarkdown(md)` swaps `lov-img://` refs for short-lived blob URLs at preview/render time.
- Wire into `LessonPage` and admin preview so images appear everywhere they're referenced.

### 3. Markdown formatting toolbar (new `MarkdownEditor` component)
Buttons: Bold, Italic, H1/H2/H3, bulleted list, numbered list, quote, inline code, code block, link, image upload, undo, redo. Keyboard shortcuts: ⌘B / ⌘I / ⌘K / ⌘Z / ⌘⇧Z. Drag-and-drop and paste-image support inserts an image upload + Markdown ref automatically.

### 4. Undo / redo with coalescing
New `src/hooks/useHistory.ts`: per-field history stack with 600ms typing coalescing (so one word ≠ many entries), capped at 100 steps. Wired into title, summary, and each body field.

### 5. Dirty-state indicator + leave warning
- Compare working copy against the current draft+published merge; show a "Unsaved changes" badge in the toolbar when different.
- `beforeunload` warning when dirty.
- React Router navigation guard via a custom `useBlocker`-style prompt before leaving the editor route while dirty.
- Save button is disabled when clean; Publish button is disabled unless there are pending drafts.

### 6. Mass-edit mode
A second tab in the editor: **Single** (current) and **Bulk**.
Bulk mode UI:
- Lesson list becomes multi-select with checkboxes (Select all / Pre-work / Lessons quick filters).
- A single large textarea + a mode picker:
  - **Same body to all selected** — paste once, applies as the body to every selected lesson.
  - **Per-slug blocks** — paste a block formatted with `---slug: <slug>---` separators; each block populates that lesson's body.
- "Apply to drafts" stages the changes (doesn't publish).
- Live summary: "Will update body for N lessons."

## Toolbar layout (admin)

```text
[← Exit]  [Single | Bulk]   ● Unsaved · 3 drafts pending
                              [Import] [Export] [Discard] [Save Draft] [Publish]
```

- **Save Draft** writes the working copy into the Draft layer.
- **Publish** promotes the current lesson's draft (or all drafts via dropdown) to Published.
- **Discard** drops the current lesson's draft.

## Files

**New**
- `src/lib/imageStore.ts` — IndexedDB image CRUD + markdown URL resolver
- `src/hooks/useResolvedMarkdown.ts` — resolves `lov-img://` refs to blob URLs
- `src/hooks/useHistory.ts` — undo/redo stack with coalescing
- `src/hooks/useUnsavedChangesPrompt.ts` — beforeunload + router blocker
- `src/components/MarkdownEditor.tsx` — toolbar + textarea + image drop/paste
- `src/components/admin/BulkEditor.tsx` — mass-edit UI
- `src/components/admin/SingleEditor.tsx` — extracted from current AdminEditor

**Modified**
- `src/content/contentStore.ts` — split into draft + published layers
- `src/components/AdminEditor.tsx` — orchestrates Single/Bulk tabs, dirty state, publish controls
- `src/components/LessonPage.tsx` — render images via `useResolvedMarkdown`

## Out of scope
- Auth on `/admin` (still open per earlier decision).
- Cross-device sync — images and drafts live in this browser. Export/Import remains the bridge.

## Migration path to Lovable Cloud (later, one-line ask)
- `contentStore.ts` → Postgres `lesson_overrides` table, `published` boolean column.
- `imageStore.ts` → Supabase Storage bucket; `lov-img://<id>` becomes the public storage URL directly. Markdown stays valid.