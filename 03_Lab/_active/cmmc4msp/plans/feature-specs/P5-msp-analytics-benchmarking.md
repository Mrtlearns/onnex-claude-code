# P5 — Cross-Client MSP Analytics + Benchmarking

## Status: Planned | Priority: M (1 week) | Sprint: Q2

---

## Problem Statement

The MSP operator is the power user and the economic buyer of this platform. They manage a portfolio of 5–50 defense contractor clients, each at a different phase of their CMMC journey. Today the MSP dashboard is a flat table: org name, SPRS score, status. That's a client list, not a management tool.

What an MSP actually needs:

- **Triage view:** Which clients need my attention right now? Who is stuck and why?
- **Velocity data:** Is client X moving through phases at the expected pace, or are they delayed?
- **Pattern recognition:** Which controls fail most often across all my clients? Can I build a playbook or a pre-built artifact library?
- **Revenue signal:** How many billable hours of remediation work remain in my portfolio?
- **Competitive edge:** As the MSP onboards more clients, they accumulate statistical insight no solo compliance consultant can match.

Without this surface, the platform is 9 separate client dashboards — not a business intelligence tool for the MSP.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | MSP admin | To see a portfolio health score (weighted avg SPRS across all clients) | I have a single number to track and report to leadership |
| US-02 | MSP admin | To see which clients haven't had activity in 7+ days | I can proactively unblock stuck clients |
| US-03 | MSP admin | To see which controls fail most often across my entire client base | I can build a reusable playbook and artifact templates |
| US-04 | MSP admin | To see median time-to-phase-completion across clients | I can set accurate timelines and SLAs for new clients |
| US-05 | MSP admin | To see how many billable control-remediation units remain per client | I can forecast revenue and staff capacity |
| US-06 | MSP admin | To see a SPRS distribution histogram for all my clients | I can identify outliers (very low SPRS) that need urgent attention |
| US-07 | MSP admin | To benchmark a new client's SPRS starting point against similar clients | I can set realistic expectations at kickoff |

---

## Technical Design

### Data Sources (all existing — no new tables required)

| Metric | Source |
|--------|--------|
| SPRS score | `programs.sprs_score` |
| Phase progress | `programs.current_phase`, `program_controls.status` counts |
| Activity recency | `activity_log.created_at` filtered by org |
| Control failures | `program_controls.status` grouped by `control_definitions.nist_id` |
| Phase completion time | `assignment_events` + `program_controls.updated_at` timestamps |
| Assessment volumes | `assessments` count per program |
| MSP scoping | `orgs.msp_id` → `programs.org_id` → all child data |

The entire analytics feature can be built as **Hasura aggregation queries** + **one new Next.js page** + **one new FastAPI endpoint** for complex aggregations that Hasura can't express efficiently.

### Hasura Aggregation Queries

Track no new tables — leverage existing Hasura metadata with aggregation queries:

```graphql
# Portfolio health score
query MspPortfolioHealth($msp_id: uuid!) {
  programs_aggregate(where: {org: {msp_id: {_eq: $msp_id}}}) {
    aggregate {
      avg { sprs_score }
      min { sprs_score }
      max { sprs_score }
      count
    }
  }
}

# Stalled programs (no activity in 7 days)
query StalledPrograms($msp_id: uuid!, $since: timestamptz!) {
  orgs(where: {msp_id: {_eq: $msp_id}}) {
    name slug
    programs {
      id name sprs_score current_phase
      activity_logs_aggregate(where: {created_at: {_gt: $since}}) {
        aggregate { count }
      }
    }
  }
}

# Common failing controls across MSP
query CommonFailingControls($msp_id: uuid!) {
  program_controls_aggregate(
    where: {
      program: {org: {msp_id: {_eq: $msp_id}}}
      status: {_in: ["not_implemented", "partially_implemented"]}
    }
    group_by: ["control_definition_id"]
    order_by: {count: desc}
    limit: 20
  ) {
    aggregate { count }
    nodes { control_definition { nist_id family requirement_text } }
  }
}
```

### FastAPI Changes

**New endpoint: `GET /api/analytics/msp-summary`** (requires `msp_admin` role)

This endpoint handles the complex aggregations that are awkward in Hasura (e.g., phase duration calculation, SPRS histogram bucket assignment, billable units estimate):

```python
@router.get("/msp-summary")
async def msp_summary(
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    """
    Returns:
    - sprs_histogram: [{bucket: "-203 to -150", count: 2}, ...]
    - phase_duration_medians: [{phase: "phase_1", median_days: 18.5}, ...]
    - top_failing_controls: [{nist_id: "3.1.1", fail_count: 12, family: "AC"}, ...]
    - stalled_programs: [{program_id: ..., days_inactive: 12, org_name: ...}, ...]
    - billable_units: [{org_name: ..., open_controls: 43, estimated_hours: 86}, ...]
    - portfolio_health: {avg_sprs: -47, min_sprs: -203, max_sprs: 89, total_programs: 8}
    """
```

The endpoint uses a single complex SQL query with CTEs for performance — one DB round-trip.

**New endpoint: `GET /api/analytics/control-playbook`** (requires `msp_admin`)

Returns the top-N failing controls with MSP's own historical evidence of what worked: which artifact types led to `fully_implemented` for each control across their client base.

```python
# "For AC.L2-3.1.1, your most successful evidence types have been:
#  1. Azure AD Policy export (8/9 clients passed)
#  2. CrowdStrike endpoint report (4/6 clients passed)"
```

### Frontend Changes

**New page: `/msp/analytics`** (accessible to msp_admin only)

Layout: full-width, data-dense — designed for a 27" monitor, not mobile.

**Row 1 — KPI Strip:**
```
[ Portfolio Health: -47 avg SPRS ]  [ 8 Active Programs ]  [ 3 Stalled (7d+) ]  [ 124 Assessments This Month ]
```

**Row 2 — SPRS Distribution Histogram:**
- Bar chart: buckets of 20 SPRS points (-203 to -180, -180 to -160, ..., 80 to 110)
- Each bar labeled with client count
- Click a bar → filtered program list in sidebar

**Row 3 — Two-column layout:**
- **Left: Phase Velocity** — horizontal bar chart, each client = one bar, bar length = days in current phase, color = phase number. Hover shows client name + phase.
- **Right: Common Failing Controls** — ranked table: Control ID | Family | Clients Failing | % of Portfolio | "View Playbook"

**Row 4 — Stalled Programs:**
- Table: Org name | Phase | Last activity | SPRS | Days stalled | "Go to program" button
- Sorted by days_stalled DESC

**Row 5 — Billable Units Forecast:**
- Table: Org name | Open controls | Est. hours (open_controls × 2h default, configurable) | Phase | SPRS
- Total row at bottom with portfolio-wide remaining work

**Row 6 — Control Playbook:**
- Accordion by control family (AC, IA, CM, etc.)
- Each control: "Fail rate: 67% | Most effective evidence: Azure AD Policy Export | Avg resolution: 12 days"

### Navigation Changes

- Add "Analytics" link in MSP admin sidebar (visible to `msp_admin` only)
- Badge on nav item: count of stalled programs (red dot if > 0)

---

## Implementation Phases

**Phase 1 (Days 1-2):** FastAPI `/api/analytics/msp-summary` endpoint with all SQL aggregations. Unit tests.

**Phase 2 (Days 3-4):** Frontend analytics page — KPI strip, histogram, failing controls table, stalled programs table.

**Phase 3 (Day 5):** Phase velocity chart, billable units, control playbook accordion. Nav badge.

---

## Acceptance Criteria

- [ ] `/api/analytics/msp-summary` returns correct aggregations for a known test fixture
- [ ] SPRS histogram groups correct programs into each bucket
- [ ] Stalled programs list is accurate (no activity in 7d, scoped to current MSP)
- [ ] Top failing controls are scoped strictly to current MSP's clients (not cross-MSP)
- [ ] Analytics page only accessible to msp_admin role (403 for client_admin)
- [ ] Page loads in < 2s with 20 programs and 2,200 program_controls
- [ ] All charts update on page refresh (no client-side caching beyond 60s)
- [ ] Phase duration medians reflect real `assignment_events` timestamps
- [ ] Billable units estimate is configurable per MSP (stored in `msps` JSONB config)
- [ ] All existing pytest tests still pass
