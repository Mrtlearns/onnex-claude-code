---
name: quotes
description: "Skill for the Quotes area of ndt-portal-v1. 10 symbols across 1 files."
---

# Quotes

10 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `frontend/`
- Understanding how QuotesApp work
- Modifying quotes-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/quotes/QuotesApp.tsx` | fmt, fmtDate, UtQuoteDetailDialog, toggleItem, RtQuoteDetailDialog (+5) |

## Entry Points

Start here when exploring this area:

- **`QuotesApp`** (Function) — `frontend/src/components/quotes/QuotesApp.tsx:665`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `QuotesApp` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 665 |
| `fmt` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 126 |
| `fmtDate` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 130 |
| `UtQuoteDetailDialog` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 169 |
| `toggleItem` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 203 |
| `RtQuoteDetailDialog` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 432 |
| `generateAndDownloadPdf` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 139 |
| `handlePdf` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 227 |
| `generateAndPreviewPdf` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 152 |
| `handlePreview` | Function | `frontend/src/components/quotes/QuotesApp.tsx` | 238 |

## How to Explore

1. `gitnexus_context({name: "QuotesApp"})` — see callers and callees
2. `gitnexus_query({query: "quotes"})` — find related execution flows
3. Read key files listed above for implementation details
