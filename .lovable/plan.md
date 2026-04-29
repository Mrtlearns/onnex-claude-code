## Goals

1. **Asset cleanup screen** — list uploaded images/PDFs, flag unused ones, allow safe deletion.
2. **Publish activity log** — record every publish event with timestamp + title snapshot.
3. **Per-lesson draft version history** — keep last 20 autosaved snapshots per lesson, view + restore.
4. **Seed lesson content** — fetch from `docs.claude.com/claude-code` and `claude-code.lovable.app`, rephrase with Lovable AI, populate `src/content/lessons.ts` so lessons aren't placeholder text.

---

## 1. Asset cleanup screen

Extend `src/lib/imageStore.ts`:
- `listAssets()` → returns `{ id, name, type, size, createdAt }[]` (no blob payload).
- `deleteAsset(id)` → removes from IndexedDB + revokes cached object URL.
- Track type properly so PDFs vs images can be filtered.

New utility `src/lib/assetUsage.ts`:
- Scan all draft + published lesson bodies for `lov-img://<id>` references.
- Return `Set<string>` of referenced ids → anything else is "unused".

New component `src/components/AssetManager.tsx` (rendered inside Admin via a new "Assets" tab on the toolbar):
- Grid/list of assets with thumbnail (image preview via resolved object URL) or PDF icon.
- Columns: preview, name, type, size, created, "Used in N lessons" (or "Unused" badge).
- Filter chips: All / Unused only / Images / PDFs.
- Bulk-select checkboxes + "Delete selected" with confirm dialog. "Delete all unused" shortcut.
- Click "Used in N lessons" → popover listing the lesson titles linking to that asset.

## 2. Publish activity log

New module `src/lib/activityLog.ts` (localStorage key `vci.activity.v1`):
- `logPublish({ slug, title, summary, bodyPreview, at, scope: "single" | "all", count })`.
- `getActivity()` → newest-first array, capped at 200 entries.
- `clearActivity()`.
- Reactive subscribe pattern matching `contentStore.ts`.

Hook `publishDraft` calls in `AdminEditor.tsx`:
- Per-lesson Publish (toolbar button, list-row rocket): log one entry with that lesson's snapshot.
- Publish all: log one summary entry plus one per promoted slug.

New component `src/components/ActivityLog.tsx` shown as a third toolbar tab "History":
- Reverse-chronological list grouped by day.
- Each row: timestamp (relative + absolute on hover), lesson title, scope badge ("single" / "in batch"), expandable summary + body preview (first ~200 chars of markdown).
- "Clear log" with confirm.

## 3. Per-lesson draft version history

New module `src/lib/draftHistory.ts` (localStorage key `vci.draft-history.v1`, shape `Record<slug, Snapshot[]>`):
- `Snapshot = { id, at, title, summary, body }`.
- `pushSnapshot(slug, snapshot)` — dedupes if identical to the latest, caps at **20** per slug, evicts oldest.
- `getHistory(slug)` / `useHistory(slug)` reactive hook.
- `clearHistory(slug)`.

Wire into `SingleEditor` autosave:
- In the existing `useDebouncedEffect` autosave block, after `setDraft(...)`, also call `pushSnapshot(lesson.slug, ...)`.
- After publish, push a final "published" marker snapshot.

New component `src/components/VersionHistoryDialog.tsx`:
- Trigger: "History" button next to "Save now" / "Publish" in the editor toolbar (badge with count).
- Left pane: list of snapshots (relative time, title diff indicator).
- Right pane: read-only markdown preview of selected snapshot + side-by-side or unified diff against current draft (use a tiny line-diff helper, no heavy dep).
- "Restore" button → swaps editor state to that snapshot (uses existing `useHistory` `reset`) and triggers an autosave; original current state still on the stack as the newest snapshot.

## 4. Seed lesson content (rephrased from source)

**Sources**:
- `https://docs.claude.com/en/docs/claude-code` (and key sub-pages: install, CLAUDE.md, skills, MCP, building projects).
- `https://claude-code.lovable.app/` (lesson titles + structure are already mirrored).

**Process** (one-off, runs during this build, not part of the app):
1. Use `code--fetch_website` (markdown mode) to pull each docs page into `/tmp/source/`.
2. For each lesson in `src/content/lessons.ts`, build a prompt: "Rewrite the following Claude Code docs into a friendly tutorial section titled '<lesson title>' for OS=<os>. Keep all commands accurate. Do not copy phrasing — restructure and rephrase. ~400-600 words. Markdown only."
3. Run via the AI gateway skill (`/tmp/lovable_ai.py`, `google/gemini-3-flash-preview`) producing per-OS markdown for OS-specific lessons (`installing-claude-code`, `getting-ready`) and single-string body for the rest.
4. Write the rephrased bodies back into `src/content/lessons.ts`, replacing all "Lesson body goes here." placeholders. Lessons 6–12 (currently generic "Lesson N") get retitled and filled with adjacent Claude Code topics (sub-agents, hooks, slash commands, headless mode, debugging workflows, cost/usage, and a wrap-up).
5. Spot-check 2–3 lessons in the preview after writing.

This populates the **default content** baked into the app — admins can still override per-lesson via the editor.

---

## Files

**New**
- `src/lib/assetUsage.ts`
- `src/lib/activityLog.ts`
- `src/lib/draftHistory.ts`
- `src/components/AssetManager.tsx`
- `src/components/ActivityLog.tsx`
- `src/components/VersionHistoryDialog.tsx`

**Edited**
- `src/lib/imageStore.ts` — add `listAssets`, `deleteAsset`, change notifications.
- `src/components/AdminEditor.tsx` — add "Editor / Assets / History" tab switch on toolbar; wire activity logging into publish actions; add History button + snapshot-on-autosave; show per-lesson Publish on list rows already exist (verify).
- `src/content/lessons.ts` — replace placeholder bodies with rephrased content; rename lessons 6–12 to real Claude Code topics.

## Notes / trade-offs

- All new persistence stays in **localStorage / IndexedDB** (no backend) consistent with existing store.
- Cap sizes (200 activity entries, 20 snapshots/lesson) keep localStorage well under quota.
- Asset deletion does **not** auto-rewrite markdown — broken `lov-img://` refs simply won't render. The "Used in" indicator + confirm dialog mitigates accidental deletion.
- AI rephrasing happens at build time (one-off script), not at runtime — no API key needed in the shipped app.
