# Report System

## Report Generation Flow

1. Admin clicks **"Evaluate Now"** on an organization
2. `OrgDetail.tsx` generates mock employee answers via `generateMockEmployeeAnswers()`
3. `generateReport()` computes all scores, gap analysis, syllabus, and costing
4. Report data is stored in `sessionStorage` with key `eval-{orgId}-{version}`
5. Admin is navigated to `/admin/report/{reportKey}`
6. `Report.tsx` reads from `sessionStorage` (or falls back to `mockReport`)

## Report Types

### Client Report (`ClientReport.tsx`)

The client-facing report includes:

| Section | Component | Description |
|---------|-----------|-------------|
| Hero | `HeroHeader` | Score dial, maturity stage badge, metadata |
| Radar Charts | `RadarCharts` | Current scores + industry benchmark overlay |
| Dimension Cards | `DimensionScoreCards` | Individual dimension score cards |
| Gap Analysis | `GapAnalysisTable` | Sortable table with priorities |
| Industry Benchmark | `IndustryBenchmark` | Org vs industry horizontal bars |
| Narratives | `NarrativeAndSteps` | Per-dimension AI-generated analysis |
| Footer | `ReportFooter` | Version, date, disclaimers |

### Internal Report (Admin only)

Added below the client report with a "CONFIDENTIAL" divider:

| Section | Component | Description |
|---------|-----------|-------------|
| Respondent Breakdown | `RespondentBreakdownTable` | Per-person scores + archetype badges |
| Engagement Costing | `EngagementCostingCard` | 5-phase fee breakdown |
| Profitability | `ProfitabilityCard` | Margin analysis |
| Training Syllabus | `ProposedSyllabusAccordion` | Expandable module details |

### AI Executive Summary

Rendered above both report tabs. Uses typewriter animation. See [AI Features](./ai-features.md).

### AI Chat Assistant

Floating chat panel at the bottom of the report page. Supports natural language queries about the report data.

## Shared/White-Label Report

Route: `/report/share/:token`

Features:
- Organization name prominently displayed
- Industry badge and version label
- Download PDF button
- Professional footer with platform attribution
- No internal data exposed

## PDF Export

`src/lib/pdf-export.ts` uses `html2canvas` + `jsPDF`:

1. Expands all accordion items (sets `data-state="open"`)
2. Captures the report element at 1.5x scale
3. Splits into A4 pages with 10mm margins
4. Internal PDFs get a red "CONFIDENTIAL" header on each page
5. Exports as JPEG-compressed PDF for smaller file size
6. Restores accordion states after capture

### Known Limitations

- Charts may not render perfectly in PDF (rasterized)
- Very long reports may hit the 40-page safety limit
- Background color is hardcoded to `#F8FAFC`

## Trend Tracking

`TrendChart.tsx` displays longitudinal data using Recharts `LineChart`:
- One line per dimension
- X-axis: evaluation version labels
- Y-axis: scores 0–5
- Color-coded dimension lines

Available on the "Trends" tab in `OrgDetail.tsx`. Requires ≥2 evaluation cycles. Currently uses `mockHistoricalScores` from `mock-data.ts`.
