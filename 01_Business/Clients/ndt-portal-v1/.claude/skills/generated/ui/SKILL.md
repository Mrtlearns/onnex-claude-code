---
name: ui
description: "Skill for the Ui area of ndt-portal-v1. 8 symbols across 6 files."
---

# Ui

8 symbols | 6 files | Cohesion: 74%

## When to Use

- Working with code in `frontend/`
- Understanding how cn, Sidebar, isActive work
- Modifying ui-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/ui/dialog.tsx` | DialogHeader, DialogFooter |
| `frontend/src/components/layout/Sidebar.tsx` | Sidebar, isActive |
| `frontend/src/lib/utils.ts` | cn |
| `frontend/src/components/ui/badge.tsx` | Badge |
| `frontend/src/components/layout/Topbar.tsx` | QuickBtn |
| `frontend/src/components/admin/JobsTab.tsx` | StatusBadge |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `frontend/src/lib/utils.ts:3`
- **`Sidebar`** (Function) — `frontend/src/components/layout/Sidebar.tsx:32`
- **`isActive`** (Function) — `frontend/src/components/layout/Sidebar.tsx:58`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `cn` | Function | `frontend/src/lib/utils.ts` | 3 |
| `Sidebar` | Function | `frontend/src/components/layout/Sidebar.tsx` | 32 |
| `isActive` | Function | `frontend/src/components/layout/Sidebar.tsx` | 58 |
| `DialogHeader` | Function | `frontend/src/components/ui/dialog.tsx` | 55 |
| `DialogFooter` | Function | `frontend/src/components/ui/dialog.tsx` | 69 |
| `Badge` | Function | `frontend/src/components/ui/badge.tsx` | 29 |
| `QuickBtn` | Function | `frontend/src/components/layout/Topbar.tsx` | 26 |
| `StatusBadge` | Function | `frontend/src/components/admin/JobsTab.tsx` | 51 |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
