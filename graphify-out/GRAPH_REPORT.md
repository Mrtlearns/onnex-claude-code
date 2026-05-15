# Graph Report - D:/Code/Claude/01_Business/Onnex/onnex-claude-code  (2026-05-15)

## Corpus Check
- 114 files · ~51,913 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 248 nodes · 267 edges · 13 communities detected
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.83)
- Token cost: 9,960 input · 2,235 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `toast()` - 13 edges
2. `readKey()` - 12 edges
3. `writeKey()` - 8 edges
4. `handlePublish()` - 7 edges
5. `pushSnapshot()` - 7 edges
6. `CLAUDE.md — Pickup brief for Claude Code` - 7 edges
7. `handleFiles()` - 6 edges
8. `setDraft()` - 6 edges
9. `useOS()` - 6 edges
10. `apply()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `onExport()` --calls--> `exportPublished()`  [INFERRED]
  src\components\AdminEditor.tsx → src\content\contentStore.ts
- `handleSaveDraftNow()` --calls--> `setDraft()`  [INFERRED]
  src\components\AdminEditor.tsx → src\content\contentStore.ts
- `handleSaveDraftNow()` --calls--> `toast()`  [INFERRED]
  src\components\AdminEditor.tsx → src\hooks\use-toast.ts
- `handlePublish()` --calls--> `setDraft()`  [INFERRED]
  src\components\AdminEditor.tsx → src\content\contentStore.ts
- `handlePublish()` --calls--> `publishDraft()`  [INFERRED]
  src\components\AdminEditor.tsx → src\content\contentStore.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.2
Nodes (18): discardAllDrafts(), discardDraft(), exportPublished(), getDraftLessonsSnapshot(), getDrafts(), getPublished(), importPublished(), notify() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (13): handleDiscard(), publishStaged(), async(), onDeleteSelected(), onDeleteUnused(), addToRemoveQueue(), dispatch(), genId() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (6): OSToggle(), useOS(), Admin(), Index(), LessonRoute(), Lessons()

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (5): applyToDrafts(), buildBody(), handleRestoreSnapshot(), handleSaveDraftNow(), onExport()

### Community 4 - "Community 4"
Cohesion: 0.26
Nodes (9): refresh(), clearHistory(), getHistory(), newId(), notify(), pushSnapshot(), read(), sameBody() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.3
Nodes (10): handleFiles(), insertAtCursor(), insertCodeBlock(), insertLink(), linePrefix(), onDrop(), onKeyDown(), onPaste() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.3
Nodes (9): deleteAsset(), getDB(), getImage(), listAssets(), newId(), notifyAssets(), resolveImageUrl(), saveImage() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.31
Nodes (9): handlePublish(), clearActivity(), getActivity(), logActivity(), newId(), notify(), previewOf(), read() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (3): ThemeToggle(), useTheme(), Toaster()

### Community 9 - "Community 9"
Cohesion: 0.28
Nodes (6): refresh(), bodyFor(), bodyTextSample(), collectFromBody(), computeAssetUsage(), computeReferencedIds()

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (5): CLAUDE.md — Pickup brief for Claude Code, README.md — Welcome to your Lovable project, On-Nex Training Portal — On-Nex Training Portal, Supabase backend build spec — On-Nex Training Portal, Test Plan — On-Nex Training Portal

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (3): enterAdmin(), exitAdmin(), setAdmin()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (2): relTime(), timeStr()

## Knowledge Gaps
- **4 isolated node(s):** `README.md — Welcome to your Lovable project`, `On-Nex Training Portal — On-Nex Training Portal`, `Supabase backend build spec — On-Nex Training Portal`, `Test Plan — On-Nex Training Portal`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 13`** (4 nodes): `dayKey()`, `relTime()`, `timeStr()`, `ActivityLog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toast()` connect `Community 1` to `Community 3`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `handleFiles()` connect `Community 5` to `Community 1`, `Community 6`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `handlePublish()` connect `Community 7` to `Community 0`, `Community 1`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `toast()` (e.g. with `handleSaveDraftNow()` and `handlePublish()`) actually correct?**
  _`toast()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `handlePublish()` (e.g. with `setDraft()` and `publishDraft()`) actually correct?**
  _`handlePublish()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `pushSnapshot()` (e.g. with `handlePublish()` and `handleRestoreSnapshot()`) actually correct?**
  _`pushSnapshot()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `README.md — Welcome to your Lovable project`, `On-Nex Training Portal — On-Nex Training Portal`, `Supabase backend build spec — On-Nex Training Portal` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._