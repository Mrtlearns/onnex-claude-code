# AI Features

All AI functionality is currently **mock/template-based** (no LLM calls). The engine lives in `src/lib/ai-mock.ts`.

## Executive Summary Generator

**Function:** `generateExecutiveSummary(report: ReportData) → string`

Produces a multi-paragraph executive summary including:
- Organization context (name, industry, respondent count)
- Overall maturity score and stage
- Strongest and weakest dimensions with commentary
- Top gap from gap analysis with recommended action
- Industry-contextual strategic observation
- Three recommended immediate actions

The summary uses randomized sentence variations via `pick()` for natural variation between reports.

## AI Chat Assistant

**Function:** `getAIChatResponse(message: string, report: ReportData) → string`

An intent-matching chat system with 10 pattern categories:

| Intent | Trigger Words | Response |
|--------|--------------|----------|
| Weaknesses | weak, worst, lowest, struggle | Identifies lowest dimension with recommendations |
| Strengths | strong, best, highest, top | Highlights top dimension with leverage advice |
| Overall | overall, total, summary, maturity | Score summary with stage classification |
| Recommendations | recommend, suggest, improve | Top 3 gaps ranked by severity |
| Gaps | gap, delta, target | Full gap analysis breakdown |
| Budget | budget, cost, price, investment | Directs to internal report costing |
| Timeline | timeline, when, how long | Standard 22-26 week transformation overview |
| Industry | industry, benchmark, compare | Live benchmark comparison with percentile |
| Respondents | respondent, participant, employee | Count and pointer to internal breakdown |
| Training | train, syllabus, course, skill | Weakest dimension training recommendation |

Unmatched queries return a helpful menu of available topics.

### Typewriter Effect

`useTypewriter(text, speed)` hook renders AI responses character-by-character for a streaming feel. Default speed: 18ms per character.

## AI Question Generator

**Function:** `generateAIQuestion(dimension: string) → Question`

Selects from curated question templates per dimension category:
- Vision, Leadership, Skills & Literacy, Governance & Ethics, Collaboration & Sharing, Technology & Data

Returns a fully-formed `Question` with 5 scored options.

## AI Question Improver

**Function:** `improveQuestion(question: Question) → Question`

Enhances existing questions:
1. Prepends a dimension-appropriate context prefix
2. Refines option text (e.g., "No " → "No formal ", "exists" → "has been established")

## Dashboard Insights

**Function:** `generateDashboardInsights(orgs) → string[]`

Returns 3 contextual insights for the admin dashboard:
1. Count of organizations ready for evaluation
2. Assessment progress summary
3. Random strategic recommendation

## Enhanced Narratives

**Function:** `generateEnhancedNarrative(dimension, score, orgName, industry) → string`

Per-dimension paragraph narratives with 5 maturity tiers (nascent → transforming). Each narrative is industry-aware and provides specific recommendations.

Used in `NarrativeAndSteps.tsx` for the Transformation Narrative section of reports.

## Future: Real AI Integration

To replace mocks with real LLM calls:

1. Create edge functions that call `https://ai.gateway.lovable.dev/v1/chat/completions`
2. Replace each mock function with a `fetch()` call to the edge function
3. Keep mock functions as fallbacks for offline/error scenarios
4. The `useTypewriter` hook works with any text source — no changes needed
