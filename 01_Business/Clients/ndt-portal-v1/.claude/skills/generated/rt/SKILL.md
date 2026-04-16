---
name: rt
description: "Skill for the Rt area of ndt-portal-v1. 5 symbols across 2 files."
---

# Rt

5 symbols | 2 files | Cohesion: 80%

## When to Use

- Working with code in `frontend/`
- Understanding how computeViewRow, computeQuoteTotals, computeTierResults work
- Modifying rt-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/lib/rt/calculations.ts` | computeViewRow, computeQuoteTotals, computeTierResults, fmt |
| `frontend/src/components/rt/RtQuoteTab.tsx` | RtQuoteTab |

## Entry Points

Start here when exploring this area:

- **`computeViewRow`** (Function) — `frontend/src/lib/rt/calculations.ts:37`
- **`computeQuoteTotals`** (Function) — `frontend/src/lib/rt/calculations.ts:65`
- **`computeTierResults`** (Function) — `frontend/src/lib/rt/calculations.ts:76`
- **`fmt`** (Function) — `frontend/src/lib/rt/calculations.ts:92`
- **`RtQuoteTab`** (Function) — `frontend/src/components/rt/RtQuoteTab.tsx:23`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `computeViewRow` | Function | `frontend/src/lib/rt/calculations.ts` | 37 |
| `computeQuoteTotals` | Function | `frontend/src/lib/rt/calculations.ts` | 65 |
| `computeTierResults` | Function | `frontend/src/lib/rt/calculations.ts` | 76 |
| `fmt` | Function | `frontend/src/lib/rt/calculations.ts` | 92 |
| `RtQuoteTab` | Function | `frontend/src/components/rt/RtQuoteTab.tsx` | 23 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RtQuoteTab → Qs` | cross_community | 4 |
| `RtQuoteTab → Remove` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Hooks | 2 calls |
| Ut | 1 calls |

## How to Explore

1. `gitnexus_context({name: "computeViewRow"})` — see callers and callees
2. `gitnexus_query({query: "rt"})` — find related execution flows
3. Read key files listed above for implementation details
