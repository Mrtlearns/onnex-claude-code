---
name: routes
description: "Skill for the Routes area of ndt-portal-v1. 10 symbols across 2 files."
---

# Routes

10 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `api/`
- Understanding how query work
- Modifying routes-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `api/src/routes/documents.ts` | extractPath, ncEncodePath, handleGet, handlePost, ensureParentDirs (+4) |
| `api/src/db.ts` | query |

## Entry Points

Start here when exploring this area:

- **`query`** (Function) — `api/src/db.ts:12`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `query` | Function | `api/src/db.ts` | 12 |
| `extractPath` | Function | `api/src/routes/documents.ts` | 34 |
| `ncEncodePath` | Function | `api/src/routes/documents.ts` | 41 |
| `handleGet` | Function | `api/src/routes/documents.ts` | 46 |
| `handlePost` | Function | `api/src/routes/documents.ts` | 125 |
| `ensureParentDirs` | Function | `api/src/routes/documents.ts` | 151 |
| `handlePut` | Function | `api/src/routes/documents.ts` | 174 |
| `handleMkdir` | Function | `api/src/routes/documents.ts` | 217 |
| `handleDelete` | Function | `api/src/routes/documents.ts` | 243 |
| `handleMaintenance` | Function | `api/src/routes/documents.ts` | 288 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandlePut → NcEncodePath` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "query"})` — see callers and callees
2. `gitnexus_query({query: "routes"})` — find related execution flows
3. Read key files listed above for implementation details
