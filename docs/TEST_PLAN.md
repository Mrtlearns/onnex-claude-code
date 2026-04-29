# Test Plan — On-Nex Training Portal

Two layers of testing: **automated unit/component tests** (vitest) and a
**manual smoke checklist** run against the live preview before each publish.

## Automated

```bash
bunx vitest run
```

Coverage:

| Suite | What it locks in |
|-------|------------------|
| `src/lib/__tests__/activityLog.test.ts` | log/get/clear, FIFO cap at 200, body preview derivation |
| `src/lib/__tests__/draftHistory.test.ts` | dedupe consecutive identical snapshots, 20-cap eviction, slug isolation |
| `src/lib/__tests__/assetUsage.test.ts` | scans draft + published bodies, draft shadows published |
| `src/content/__tests__/contentStore.test.ts` | setDraft, discardDraft, single + batch publish, snapshot merge order, export/import round-trip |
| `src/context/__tests__/ThemeContext.test.tsx` | default resolution, set/persist, cycle order, rehydration |
| `src/components/__tests__/SiteHeader.test.tsx` | theme toggle present on home and lessons, click flips `.dark` |
| `src/components/__tests__/OSPicker.test.tsx` | brand string rendered, choosing OS persists to `vci.os` |

All 29 tests must pass. CI gate: any failure blocks publish.

## Manual smoke checklist

Walk through this on the published preview after non-trivial changes.

1. **First-run flow**
   - [ ] Visit `/`. OS picker shows `ON-NEX TRAINING PORTAL` (uppercase eyebrow).
   - [ ] Theme toggle is present in the top-right and works on this page.
   - [ ] Choose macOS. Lands on `/lessons` with the new brand in the header banner.
2. **Theme**
   - [ ] Toggle from `system` → `light` → `dark` → `system` on `/`, `/lessons`, `/lessons/<any>`, `/admin`, `/docs`. The `.dark` class flips on `<html>` AND the visible background and text colours change on every route (no inverted tokens left).
   - [ ] Hard-refresh after picking dark — there is no flash of light theme.
3. **Lesson rendering**
   - [ ] Switch OS via the OS toggle in the header on a lesson page. The body content swaps in place (no navigation away from `/lessons/<slug>`) and the OS-variant ribbon shows the new OS label.
   - [ ] Bodies that have per-OS variants visibly change (e.g., install commands).
4. **Admin flow**
   - [ ] Click Admin. Editor tab opens.
   - [ ] Edit a lesson body. Autosave indicator appears within 1 second; navigating away triggers the unsaved-change prompt only if dirty.
   - [ ] Publish (per-lesson). The lesson on `/lessons/<slug>` reflects the change.
   - [ ] History tab → that lesson now shows a snapshot tagged "published". Restore an earlier snapshot — editor body updates.
5. **Bulk**
   - [ ] Bulk tab → enter shared body → Stage. Drafts appear for every targeted slug.
   - [ ] Per-slug blocks tab works the same way.
   - [ ] Publish All → activity log gets one batch entry per slug or one summary entry (depending on scope).
6. **Assets**
   - [ ] In the editor, paste an image. It uploads, gets a `lov-img://` URL, and renders inline.
   - [ ] Assets tab lists the new asset with usage count = 1.
   - [ ] Delete an unreferenced asset → it disappears; referenced assets cannot be deleted.
7. **Activity log**
   - [ ] Each publish in steps 4–6 appears in the activity log with timestamp + title snapshot.

## When something fails

- Capture the failing step number and the browser console output.
- Reproduce with `bunx vitest run --reporter=verbose <path>` if it can be unit-tested.
- Fix → rerun automated suite → re-walk affected manual steps.
