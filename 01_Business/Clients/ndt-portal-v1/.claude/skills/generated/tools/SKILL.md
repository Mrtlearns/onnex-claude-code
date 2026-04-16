---
name: tools
description: "Skill for the Tools area of ndt-portal-v1. 5 symbols across 1 files."
---

# Tools

5 symbols | 1 files | Cohesion: 89%

## When to Use

- Working with code in `frontend/`
- Understanding how ToolsApp, selectTool, handleLoad work
- Modifying tools-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/tools/ToolsApp.tsx` | loadN8nCreds, tryAutoLogin, ToolsApp, selectTool, handleLoad |

## Entry Points

Start here when exploring this area:

- **`ToolsApp`** (Function) — `frontend/src/components/tools/ToolsApp.tsx:72`
- **`selectTool`** (Function) — `frontend/src/components/tools/ToolsApp.tsx:81`
- **`handleLoad`** (Function) — `frontend/src/components/tools/ToolsApp.tsx:98`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ToolsApp` | Function | `frontend/src/components/tools/ToolsApp.tsx` | 72 |
| `selectTool` | Function | `frontend/src/components/tools/ToolsApp.tsx` | 81 |
| `handleLoad` | Function | `frontend/src/components/tools/ToolsApp.tsx` | 98 |
| `loadN8nCreds` | Function | `frontend/src/components/tools/ToolsApp.tsx` | 18 |
| `tryAutoLogin` | Function | `frontend/src/components/tools/ToolsApp.tsx` | 34 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 1 calls |

## How to Explore

1. `gitnexus_context({name: "ToolsApp"})` — see callers and callees
2. `gitnexus_query({query: "tools"})` — find related execution flows
3. Read key files listed above for implementation details
