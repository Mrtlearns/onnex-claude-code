---
name: ut
description: "Skill for the Ut area of ndt-portal-v1. 12 symbols across 3 files."
---

# Ut

12 symbols | 3 files | Cohesion: 74%

## When to Use

- Working with code in `frontend/`
- Understanding how printUtQuote, printRtQuote, UtCalculatorTab work
- Modifying ut-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/lib/ut/calculations.ts` | rateForGeometry, defaultLoadTime, effectivePrice, roundUp1, computeScan (+2) |
| `frontend/src/lib/printQuote.ts` | newWin, printUtQuote, printRtQuote |
| `frontend/src/components/ut/UtCalculatorTab.tsx` | UtCalculatorTab, setDim |

## Entry Points

Start here when exploring this area:

- **`printUtQuote`** (Function) — `frontend/src/lib/printQuote.ts:57`
- **`printRtQuote`** (Function) — `frontend/src/lib/printQuote.ts:138`
- **`UtCalculatorTab`** (Function) — `frontend/src/components/ut/UtCalculatorTab.tsx:32`
- **`setDim`** (Function) — `frontend/src/components/ut/UtCalculatorTab.tsx:72`
- **`rateForGeometry`** (Function) — `frontend/src/lib/ut/calculations.ts:2`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `printUtQuote` | Function | `frontend/src/lib/printQuote.ts` | 57 |
| `printRtQuote` | Function | `frontend/src/lib/printQuote.ts` | 138 |
| `UtCalculatorTab` | Function | `frontend/src/components/ut/UtCalculatorTab.tsx` | 32 |
| `setDim` | Function | `frontend/src/components/ut/UtCalculatorTab.tsx` | 72 |
| `rateForGeometry` | Function | `frontend/src/lib/ut/calculations.ts` | 2 |
| `defaultLoadTime` | Function | `frontend/src/lib/ut/calculations.ts` | 8 |
| `effectivePrice` | Function | `frontend/src/lib/ut/calculations.ts` | 120 |
| `computeScan` | Function | `frontend/src/lib/ut/calculations.ts` | 18 |
| `computeWeight` | Function | `frontend/src/lib/ut/calculations.ts` | 102 |
| `computeLot` | Function | `frontend/src/lib/ut/calculations.ts` | 124 |
| `newWin` | Function | `frontend/src/lib/printQuote.ts` | 22 |
| `roundUp1` | Function | `frontend/src/lib/ut/calculations.ts` | 14 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UtCalculatorTab → RoundUp1` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "printUtQuote"})` — see callers and callees
2. `gitnexus_query({query: "ut"})` — find related execution flows
3. Read key files listed above for implementation details
