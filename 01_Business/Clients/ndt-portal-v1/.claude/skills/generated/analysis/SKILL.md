---
name: analysis
description: "Skill for the Analysis area of ndt-portal-v1. 12 symbols across 3 files."
---

# Analysis

12 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `frontend/`
- Understanding how AnalysisPage, poll, ExecutionLogViewer work
- Modifying analysis-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/analysis/AnalysisPage.tsx` | buildProgressMap, fmtTime, overallStatus, AnalysisPage, poll |
| `frontend/src/components/analysis/ExecutionLogViewer.tsx` | stepLabel, fmtTime, ExecutionLogViewer, safeParseJson, PayloadPanel |
| `frontend/src/components/analysis/PipelineHistory.tsx` | PipelineHistory, load |

## Entry Points

Start here when exploring this area:

- **`AnalysisPage`** (Function) — `frontend/src/components/analysis/AnalysisPage.tsx:250`
- **`poll`** (Function) — `frontend/src/components/analysis/AnalysisPage.tsx:338`
- **`ExecutionLogViewer`** (Function) — `frontend/src/components/analysis/ExecutionLogViewer.tsx:271`
- **`PipelineHistory`** (Function) — `frontend/src/components/analysis/PipelineHistory.tsx:25`
- **`load`** (Function) — `frontend/src/components/analysis/PipelineHistory.tsx:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `AnalysisPage` | Function | `frontend/src/components/analysis/AnalysisPage.tsx` | 250 |
| `poll` | Function | `frontend/src/components/analysis/AnalysisPage.tsx` | 338 |
| `ExecutionLogViewer` | Function | `frontend/src/components/analysis/ExecutionLogViewer.tsx` | 271 |
| `PipelineHistory` | Function | `frontend/src/components/analysis/PipelineHistory.tsx` | 25 |
| `load` | Function | `frontend/src/components/analysis/PipelineHistory.tsx` | 31 |
| `buildProgressMap` | Function | `frontend/src/components/analysis/AnalysisPage.tsx` | 226 |
| `fmtTime` | Function | `frontend/src/components/analysis/AnalysisPage.tsx` | 232 |
| `overallStatus` | Function | `frontend/src/components/analysis/AnalysisPage.tsx` | 237 |
| `stepLabel` | Function | `frontend/src/components/analysis/ExecutionLogViewer.tsx` | 58 |
| `fmtTime` | Function | `frontend/src/components/analysis/ExecutionLogViewer.tsx` | 64 |
| `safeParseJson` | Function | `frontend/src/components/analysis/ExecutionLogViewer.tsx` | 69 |
| `PayloadPanel` | Function | `frontend/src/components/analysis/ExecutionLogViewer.tsx` | 140 |

## How to Explore

1. `gitnexus_context({name: "AnalysisPage"})` — see callers and callees
2. `gitnexus_query({query: "analysis"})` — find related execution flows
3. Read key files listed above for implementation details
