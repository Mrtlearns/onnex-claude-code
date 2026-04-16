---
name: hooks
description: "Skill for the Hooks area of ndt-portal-v1. 18 symbols across 12 files."
---

# Hooks

18 symbols | 12 files | Cohesion: 94%

## When to Use

- Working with code in `frontend/`
- Understanding how computeRates, computeFilmSize, buildFilmSizeMap work
- Modifying hooks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/lib/api.ts` | qs, list, singleton, remove |
| `frontend/src/lib/rt/calculations.ts` | computeRates, computeFilmSize, buildFilmSizeMap |
| `frontend/src/lib/rt/hooks/useRtQuote.ts` | useRtQuotes, useRtViewRows |
| `frontend/src/components/ut/UtApp.tsx` | UtApp |
| `frontend/src/components/rt/RtApp.tsx` | RtApp |
| `frontend/src/lib/rt/hooks/useRtSettings.ts` | useRtSettings |
| `frontend/src/lib/rt/hooks/useRtPricingTiers.ts` | useRtPricingTiers |
| `frontend/src/lib/rt/hooks/useRtOperators.ts` | useRtOperators |
| `frontend/src/lib/rt/hooks/useRtFilmSizes.ts` | useRtFilmSizes |
| `frontend/src/lib/ut/hooks/useUtSettings.ts` | useUtSettings |

## Entry Points

Start here when exploring this area:

- **`computeRates`** (Function) — `frontend/src/lib/rt/calculations.ts:2`
- **`computeFilmSize`** (Function) — `frontend/src/lib/rt/calculations.ts:22`
- **`buildFilmSizeMap`** (Function) — `frontend/src/lib/rt/calculations.ts:29`
- **`UtApp`** (Function) — `frontend/src/components/ut/UtApp.tsx:9`
- **`RtApp`** (Function) — `frontend/src/components/rt/RtApp.tsx:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `computeRates` | Function | `frontend/src/lib/rt/calculations.ts` | 2 |
| `computeFilmSize` | Function | `frontend/src/lib/rt/calculations.ts` | 22 |
| `buildFilmSizeMap` | Function | `frontend/src/lib/rt/calculations.ts` | 29 |
| `UtApp` | Function | `frontend/src/components/ut/UtApp.tsx` | 9 |
| `RtApp` | Function | `frontend/src/components/rt/RtApp.tsx` | 11 |
| `useRtSettings` | Function | `frontend/src/lib/rt/hooks/useRtSettings.ts` | 4 |
| `useRtQuotes` | Function | `frontend/src/lib/rt/hooks/useRtQuote.ts` | 4 |
| `useRtViewRows` | Function | `frontend/src/lib/rt/hooks/useRtQuote.ts` | 28 |
| `useRtPricingTiers` | Function | `frontend/src/lib/rt/hooks/useRtPricingTiers.ts` | 4 |
| `useRtOperators` | Function | `frontend/src/lib/rt/hooks/useRtOperators.ts` | 4 |
| `useRtFilmSizes` | Function | `frontend/src/lib/rt/hooks/useRtFilmSizes.ts` | 4 |
| `useUtSettings` | Function | `frontend/src/lib/ut/hooks/useUtSettings.ts` | 4 |
| `useUtMaterials` | Function | `frontend/src/lib/ut/hooks/useUtMaterials.ts` | 4 |
| `useUtCustomers` | Function | `frontend/src/lib/ut/hooks/useUtCustomers.ts` | 4 |
| `qs` | Function | `frontend/src/lib/api.ts` | 5 |
| `list` | Method | `frontend/src/lib/api.ts` | 28 |
| `singleton` | Method | `frontend/src/lib/api.ts` | 33 |
| `remove` | Method | `frontend/src/lib/api.ts` | 65 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RtQuoteTab → Qs` | cross_community | 4 |
| `RtApp → CamelCaseKeys` | cross_community | 4 |
| `RtApp → Qs` | intra_community | 4 |
| `UtApp → CamelCaseKeys` | cross_community | 4 |
| `UtApp → Qs` | intra_community | 4 |
| `RtQuoteTab → Remove` | cross_community | 3 |
| `UtApp → Remove` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_45 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "computeRates"})` — see callers and callees
2. `gitnexus_query({query: "hooks"})` — find related execution flows
3. Read key files listed above for implementation details
