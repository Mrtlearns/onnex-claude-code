# A4 — Multi-Artifact Cross-Control Gap Synthesis

## Status: Planned | Priority: M (1 week) | Sprint: Q2

---

## Problem Statement

Today's artifact assessment is one-dimensional: upload one document, get one verdict for one control. But CMMC controls are decomposed into multiple objectives (3.1.1 has four: [a], [b], [c], [d]), and each objective may require a different type of evidence.

The current `suggestions` router tells you which *existing* artifacts are *similar* to a control. It does not tell you:
- Which objectives are covered by existing evidence
- Which objectives have no evidence at all
- Specifically what type of evidence would satisfy the uncovered objectives
- Whether two artifacts together cover all objectives, even if neither covers them all alone

This leaves users staring at a "partial" verdict with no guidance on what to upload next. The gap analysis feature solves this: it synthesizes across all available evidence, maps each piece to specific objectives, and generates a prioritized upload shopping list.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client admin | To see exactly which objectives of a control are satisfied and which aren't | I know specifically what evidence to find |
| US-02 | Client admin | To get a plain-English description of what I still need to upload | I don't have to parse NIST technical language |
| US-03 | MSP admin | To run gap analysis on behalf of a client | I can prepare an evidence-gathering checklist |
| US-04 | Client user | To see what artifact types have worked for similar controls in the past | I know what format the evidence should be in |
| US-05 | Client admin | To save a gap analysis to PDF and share it with my team | I can assign evidence-gathering tasks to the right people |
| US-06 | Platform | To auto-update the gap analysis when a new artifact is uploaded | The analysis stays current without manual re-run |

---

## Technical Design

### Gap Analysis Logic

For a given `program_control_id`:

```
1. Fetch all objectives for this control (control_definitions WHERE nist_id LIKE '3.1.1.%' AND is_objective = TRUE)
2. Fetch all artifacts uploaded to this control + their assessments
3. Fetch all org artifacts (from other controls) with cosine similarity > 0.5 to this control
4. For each artifact (direct + cross-control): extract which objectives it addresses from the assessment rationale
5. Map coverage: objective → [artifact_id, coverage_confidence]
6. Identify uncovered objectives (no artifact above 0.6 confidence for that objective)
7. For each uncovered objective: generate a specific evidence request
8. Return structured gap report
```

### Claude Prompt for Gap Synthesis

```
You are a CMMC Level 2 compliance gap analyst. Your job is to determine which 
specific objectives of a control are satisfied by existing evidence and which need 
additional artifacts.

CONTROL: {nist_id} — {requirement_text}

ALL OBJECTIVES (must each be satisfied):
{objectives_list with letters [a], [b], [c], [d]...}

EXISTING EVIDENCE FOR THIS CONTROL:
{for each artifact: file_name, assessment_verdict, assessment_rationale, gaps_noted}

RELATED EVIDENCE FROM OTHER CONTROLS (similarity > 0.5):
{for each: file_name, controlling_control, verdict, relevant_excerpt}

TASK:
For each objective [a], [b], [c], etc.:
1. Assess coverage: "Met", "Partially Met", or "Not Covered"
2. Cite the artifact(s) providing coverage (by file name)
3. If not covered: describe in plain English (≤ 2 sentences) what specific evidence 
   would satisfy it. Be concrete — name the type of document, screenshot, or log.

Return a JSON object:
{
  "objectives": [
    {
      "letter": "a",
      "text": "...",
      "coverage": "Met" | "Partially Met" | "Not Covered",
      "covered_by": ["artifact_file_name"],
      "evidence_needed": null | "Upload a screenshot of your Azure AD conditional access rule that enforces MFA for all users."
    }
  ],
  "overall_assessment": "2 of 4 objectives covered. Priority uploads: ...",
  "suggested_next_upload": "The highest-impact next upload would be..."
}
```

Model: `anthropic/claude-sonnet-4-6` via OpenRouter.

### Data Model Changes

**New table: `control_gap_analyses`**

```sql
CREATE TABLE control_gap_analyses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_control_id  UUID NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    requested_by        UUID NOT NULL REFERENCES users(id),
    status              TEXT DEFAULT 'generating',  -- generating | ready | error
    objectives_covered  INT,
    objectives_total    INT,
    coverage_pct        FLOAT,
    gap_report          JSONB NOT NULL DEFAULT '{}',    -- full structured JSON from Claude
    overall_assessment  TEXT,
    suggested_next_upload TEXT,
    model_used          TEXT,
    artifact_ids_analyzed UUID[],   -- which artifacts were considered
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON control_gap_analyses (program_control_id, created_at DESC);
```

### FastAPI Changes

**New endpoints in `app/routers/controls.py`:**

```
POST   /api/controls/program/{program_id}/{control_id}/gap-analysis
    # Trigger analysis (async background task)
    # Returns: { "analysis_id": "...", "status": "generating" }

GET    /api/controls/program/{program_id}/{control_id}/gap-analysis
    # List analyses for this control (most recent first)
    # Returns: [{ id, status, coverage_pct, created_at, objectives_covered, objectives_total }]

GET    /api/controls/program/{program_id}/{control_id}/gap-analysis/{analysis_id}
    # Full analysis detail
    # Returns: { gap_report (JSONB), overall_assessment, suggested_next_upload, artifact_ids_analyzed }

GET    /api/controls/program/{program_id}/{control_id}/gap-analysis/{analysis_id}/pdf
    # Export gap analysis as PDF (for sharing with team)
```

**New service: `app/services/gap_analysis_service.py`**

```python
async def run_gap_analysis(
    program_control_id: UUID,
    requested_by_user_id: UUID,
    conn: asyncpg.Connection,
) -> UUID:
    """
    Background task.
    1. Fetch objectives, artifacts, assessments, cross-control evidence
    2. Build prompt
    3. Call OpenRouter (claude-sonnet-4-6, non-streaming, JSON output)
    4. Parse JSON response
    5. Save to control_gap_analyses
    6. Return analysis_id
    """
```

**Trigger on artifact assessment complete:**

In `POST /api/webhooks/n8n/assessment-complete` (existing webhook handler), after updating control status, check if a gap analysis exists for this control. If yes, and a new artifact was just assessed: invalidate the old analysis (mark status='stale') so the user knows to re-run. Don't auto-run (avoid runaway API calls on rapid uploads).

### Frontend Changes

**Control detail page (`/[orgSlug]/controls/[id]/page.tsx`):**

New "Gap Analysis" section below the artifact list:

```
[ Run Gap Analysis ]  ← button; disabled if one is already generating

Most Recent Analysis (Mar 15, 2026 — by Jane Smith):
  Coverage: ██████████░░ 3 of 4 objectives covered (75%)

  [a] ✅ Met — "Access Control Policy v2.pdf" covers this objective
  [b] ✅ Met — "Azure AD CA Policy Screenshot.pdf" covers this
  [c] ⚠️ Partially Met — "Access Control Policy v2.pdf" mentions this but lacks specifics
  [d] ❌ Not Covered — Upload an access review log showing quarterly reviews occurred
                        (screenshot from your HR system or calendar invitation)

  Next Upload: "The highest-impact artifact would be a quarterly access review log..."

  [ Export PDF ]  [ Re-run Analysis ]
```

**Visual objective coverage map:** Color-coded objective grid (green / amber / red) that appears at the top of the control detail page alongside the status badge. At a glance: "2/4 objectives covered."

---

## Auto-Update Behavior

When a new artifact is uploaded and assessed for a control:
- If the control has an existing gap analysis: add a banner: "New evidence uploaded since last analysis — re-run for updated coverage"
- The banner persists until the analysis is re-run
- This avoids stale analyses misleading users while not burning API calls automatically

---

## Implementation Phases

**Phase 1 (Days 1-2):** DB migration (control_gap_analyses). `gap_analysis_service.py` (context assembly + OpenRouter call + JSON parse + save). FastAPI endpoints (generate + get).

**Phase 2 (Day 3):** Webhook integration (mark analysis stale on new assessment). PDF export endpoint (ReportLab — reuse report_service.py patterns).

**Phase 3 (Days 4-5):** Frontend gap analysis section. Objective coverage grid component. Re-run banner logic.

---

## Acceptance Criteria

- [ ] Gap analysis generates in <20s for a control with 5 existing artifacts
- [ ] Claude correctly maps assessment rationale to specific objectives [a], [b], etc.
- [ ] "Not Covered" objectives get concrete, actionable evidence requests (not generic)
- [ ] Cross-control artifacts from the same org are included when similarity > 0.5
- [ ] Coverage percentage matches the objective-by-objective breakdown
- [ ] Stale banner appears after new artifact is uploaded to same control
- [ ] PDF export includes all objectives with coverage status and evidence requests
- [ ] 403 if user from different org requests gap analysis
- [ ] Background task doesn't block the API response (returns immediately with analysis_id)
- [ ] All existing pytest tests still pass
