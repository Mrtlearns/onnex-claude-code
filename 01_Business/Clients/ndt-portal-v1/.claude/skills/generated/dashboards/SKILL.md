---
name: dashboards
description: "Skill for the Dashboards area of ndt-portal-v1. 19 symbols across 3 files."
---

# Dashboards

19 symbols | 3 files | Cohesion: 89%

## When to Use

- Working with code in `frontend/`
- Understanding how AnalyticsDashboard, filterBySvc, filterByMkt work
- Modifying dashboards-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | downloadCSV, buildYoyData, pivotToWide, fmt, fmtPct (+10) |
| `frontend/src/components/dashboards/DashboardsApp.tsx` | isAnalysisEnabled, DashboardsApp |
| `frontend/src/components/dashboards/AiAssistant.tsx` | AiAssistant, send |

## Entry Points

Start here when exploring this area:

- **`AnalyticsDashboard`** (Function) — `frontend/src/components/dashboards/AnalyticsDashboard.tsx:373`
- **`filterBySvc`** (Function) — `frontend/src/components/dashboards/AnalyticsDashboard.tsx:457`
- **`filterByMkt`** (Function) — `frontend/src/components/dashboards/AnalyticsDashboard.tsx:462`
- **`DashboardsApp`** (Function) — `frontend/src/components/dashboards/DashboardsApp.tsx:19`
- **`applyRange`** (Function) — `frontend/src/components/dashboards/AnalyticsDashboard.tsx:415`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `AnalyticsDashboard` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 373 |
| `filterBySvc` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 457 |
| `filterByMkt` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 462 |
| `DashboardsApp` | Function | `frontend/src/components/dashboards/DashboardsApp.tsx` | 19 |
| `applyRange` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 415 |
| `AiAssistant` | Function | `frontend/src/components/dashboards/AiAssistant.tsx` | 101 |
| `send` | Function | `frontend/src/components/dashboards/AiAssistant.tsx` | 113 |
| `downloadCSV` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 132 |
| `buildYoyData` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 146 |
| `pivotToWide` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 160 |
| `fmt` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 171 |
| `fmtPct` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 177 |
| `computeProjection` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 182 |
| `toISO` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 93 |
| `presetRange` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 95 |
| `readUrlRange` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 108 |
| `DateRangeFilter` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 317 |
| `isAnalysisEnabled` | Function | `frontend/src/components/dashboards/DashboardsApp.tsx` | 8 |
| `pushUrlRange` | Function | `frontend/src/components/dashboards/AnalyticsDashboard.tsx` | 119 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AnalyticsDashboard → ToISO` | cross_community | 4 |
| `DateRangeFilter → ToISO` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "AnalyticsDashboard"})` — see callers and callees
2. `gitnexus_query({query: "dashboards"})` — find related execution flows
3. Read key files listed above for implementation details
