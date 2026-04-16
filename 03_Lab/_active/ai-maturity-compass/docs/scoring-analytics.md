# Scoring & Analytics

## Score Computation

All scoring logic lives in `src/lib/scoring-service.ts`.

### Per-Respondent Scores

For each respondent:
1. Group their answers by dimension
2. Average scores within each dimension → `dimScores[dimension]`
3. Compute overall `avgScore` = mean of all dimension scores

### Weighted Organization Scores

Respondent scores are weighted by `employeesAffected` — the number of employees influenced by that person's AI decisions:

```
weightedScore[dim] = Σ(respondent.scores[dim] × respondent.employeesAffected) / Σ(employeesAffected)
```

This ensures C-suite responses (affecting hundreds) carry proportionally more weight than individual contributors.

### Dimension Scores Output

Each dimension produces:
- `avg` — Simple arithmetic mean across respondents
- `weighted` — Influence-weighted average

## AI Maturity Archetypes

Each respondent is classified into an archetype based on their average score (`scoring-service.ts`):

| Avg Score | Archetype |
|-----------|-----------|
| < 2.0 | **AI Novice** |
| 2.0 – 2.9 | **AI Explorer** |
| 3.0 – 3.7 | **AI Practitioner** |
| 3.8 – 4.4 | **AI Strategist** |
| ≥ 4.5 | **AI Transformer** |

Each archetype includes a `rationale` string highlighting strongest/weakest dimensions.

## Gap Analysis

For each dimension (`scoring-service.ts → computeGapAnalysis`):

```
target = min(5.0, weightedScore + 1.2 + random(0, 0.3))
gap = target - weightedScore
priority = gap ≥ 1.4 → "High" | gap ≥ 1.0 → "Medium" | else → "Low"
```

## Industry Benchmarks

Curated benchmark data in `src/lib/benchmarks.ts` covers 5 industries:

| Industry | Avg AI Maturity |
|----------|----------------|
| Technology | ~3.75 |
| Financial Services | ~3.05 |
| Healthcare | ~2.61 |
| Retail | ~2.65 |
| Energy | ~2.49 |

### Benchmark Matching

`getIndustryBenchmark(industry)` uses fuzzy matching:
1. Exact key match
2. Alias lookup (e.g., "banking" → "Financial Services", "tech" → "Technology")
3. Partial string match

### Percentile Estimation

```
percentile = 50 + (orgAvg - industryAvg) × 30
```
Clamped to 5–95 range.

## Engagement Costing

The internal report includes a 5-phase costing model (`scoring-service.ts → computeCosting`):

| Phase | Description | Base Fee |
|-------|-------------|----------|
| Phase 1 | AI Readiness Assessment & Strategy Workshop | $8,500 |
| Phase 2 | Custom AI Training Program Design & Delivery | $22,000 |
| Phase 3 | AI Implementation & Integration Support | $35,000 |
| Phase 4 | Change Management & Adoption Program | $25,000 |
| Phase 5 | Ongoing Support & Optimization | $18,000 |

Fees scale by respondent count:
- ≤ 10 respondents → 0.8x multiplier
- 11–20 respondents → 1.0x
- 20+ respondents → 1.2x

Profitability: delivery cost = 32% of total fee.

## Training Syllabus

Auto-generated for dimensions scoring below 3.5 (`computeSyllabus`):
- Sorted weakest-first
- Duration scales with gap severity: `max(2, round((4 - score) × 2))` hours
- Each module includes objectives, target audience, and format specification
