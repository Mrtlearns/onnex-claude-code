---
name: sfanalysis
description: "Skill for the Sfanalysis area of ndt-portal-v1. 10 symbols across 3 files."
---

# Sfanalysis

10 symbols | 3 files | Cohesion: 89%

## When to Use

- Working with code in `frontend/`
- Understanding how PartsCatalogTab, toggleExpand, CustomerOrdersTab work
- Modifying sfanalysis-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/sfanalysis/PartsCatalogTab.tsx` | fmt, fmtDate, PartsCatalogTab, toggleExpand |
| `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx` | fmt, fmtDate, CustomerOrdersTab, selectAccount |
| `frontend/src/components/sfanalysis/SfChatTab.tsx` | SfChatTab, send |

## Entry Points

Start here when exploring this area:

- **`PartsCatalogTab`** (Function) — `frontend/src/components/sfanalysis/PartsCatalogTab.tsx:50`
- **`toggleExpand`** (Function) — `frontend/src/components/sfanalysis/PartsCatalogTab.tsx:101`
- **`CustomerOrdersTab`** (Function) — `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx:62`
- **`selectAccount`** (Function) — `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx:104`
- **`SfChatTab`** (Function) — `frontend/src/components/sfanalysis/SfChatTab.tsx:93`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PartsCatalogTab` | Function | `frontend/src/components/sfanalysis/PartsCatalogTab.tsx` | 50 |
| `toggleExpand` | Function | `frontend/src/components/sfanalysis/PartsCatalogTab.tsx` | 101 |
| `CustomerOrdersTab` | Function | `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx` | 62 |
| `selectAccount` | Function | `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx` | 104 |
| `SfChatTab` | Function | `frontend/src/components/sfanalysis/SfChatTab.tsx` | 93 |
| `send` | Function | `frontend/src/components/sfanalysis/SfChatTab.tsx` | 104 |
| `fmt` | Function | `frontend/src/components/sfanalysis/PartsCatalogTab.tsx` | 28 |
| `fmtDate` | Function | `frontend/src/components/sfanalysis/PartsCatalogTab.tsx` | 33 |
| `fmt` | Function | `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx` | 52 |
| `fmtDate` | Function | `frontend/src/components/sfanalysis/CustomerOrdersTab.tsx` | 57 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 2 calls |

## How to Explore

1. `gitnexus_context({name: "PartsCatalogTab"})` — see callers and callees
2. `gitnexus_query({query: "sfanalysis"})` — find related execution flows
3. Read key files listed above for implementation details
