# A3 — Evidence Drift Detection Agent

## Status: Planned | Priority: S–M (3–5 days) | Sprint: Q2

---

## Problem Statement

A CMMC control assessed as "met" in February can silently fail in July — not because the org was breached, but because someone edited a policy document to remove a section, a vulnerability scan expired without renewal, or a conditional access policy was disabled by IT. Today the platform has no mechanism to detect this.

This is a meaningful audit risk. C3PAO assessors ask: "Is this evidence current and does it still reflect your environment?" If an artifact has drifted from its assessed state, the platform should know before the assessor does.

The technical mechanism: when an artifact is first assessed, record its embedding as a baseline. Nightly, re-embed each artifact from its current content in MinIO, compare against the baseline with cosine distance, and flag if drift exceeds a threshold. For significant drift, generate a Claude-written diff summary so the reviewer knows specifically what changed.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | MSP admin | To be alerted when a client's artifact content changes meaningfully | I catch drift before the C3PAO does |
| US-02 | Client admin | To see a "Needs Review" flag on an artifact that has drifted | I know to re-evaluate or re-upload the document |
| US-03 | MSP admin | To receive a Claude-written summary of what changed in the document | I don't have to manually diff two PDFs |
| US-04 | Platform | To demote a control's status to `needs_review` when its evidence drifts | The SPRS score reflects the uncertainty |
| US-05 | Client admin | To dismiss a drift alert with a note | I can indicate that a minor change was intentional |
| US-06 | MSP admin | To configure the drift sensitivity threshold | I can tune for noisy vs. critical environments |

---

## Technical Design

### Data Model Changes

**New columns on `artifacts`:**
```sql
ALTER TABLE artifacts
    ADD COLUMN baseline_embedding     VECTOR(1536),   -- embedding at time of assessment
    ADD COLUMN current_embedding      VECTOR(1536),   -- most recently computed embedding
    ADD COLUMN baseline_embedding_at  TIMESTAMPTZ,    -- when baseline was set
    ADD COLUMN drift_score            FLOAT,          -- 1 - cosine_similarity(baseline, current)
    ADD COLUMN drift_status           TEXT DEFAULT 'stable',  -- stable | drifted | dismissed
    ADD COLUMN drift_detected_at      TIMESTAMPTZ,
    ADD COLUMN drift_summary          TEXT,           -- Claude-generated diff summary
    ADD COLUMN drift_dismissed_by     UUID REFERENCES users(id),
    ADD COLUMN drift_dismissed_at     TIMESTAMPTZ,
    ADD COLUMN drift_dismiss_note     TEXT;
```

**New column on `program_controls`:**
```sql
ALTER TABLE program_controls
    ADD COLUMN has_drifted_evidence BOOLEAN DEFAULT FALSE;
```

**New status value:** Add `'needs_review'` as a valid `program_controls.status` — distinct from `stale` (P4, which is time-based) and `fully_implemented` (evidence still present but potentially changed).

**New table: `artifact_drift_events`** (audit log of drift detections)
```sql
CREATE TABLE artifact_drift_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    drift_score     FLOAT NOT NULL,
    drift_summary   TEXT,
    model_used      TEXT,
    detected_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolution      TEXT    -- 're_assessed' | 'dismissed' | 're_uploaded'
);
```

### Drift Detection Logic

**Threshold:** `drift_score > 0.15` triggers a flag (cosine distance, not similarity — higher = more different). Configurable per MSP via `msps.config JSONB` field: `{ "drift_threshold": 0.15 }`.

**Content re-embedding strategy:**
- For PDF/DOCX artifacts: re-extract text from MinIO using existing `extraction_service.py`, compute mean of all chunk embeddings
- For JSON integration artifacts (from P2): re-embed the serialized JSON
- For images: re-embed the extracted OCR text

**Baseline establishment:**
- Set `baseline_embedding` when assessment verdict transitions to `met` or `partial`
- Set `baseline_embedding_at = NOW()`
- Baseline is the mean of all `artifact_chunks.embedding` values for the artifact

### n8n Changes

**New Workflow 14 — Evidence Drift Monitor (nightly cron):**

```
Trigger: Cron — daily 03:00 UTC (after freshness monitor at 01:00)

Step 1: PostgreSQL — fetch all assessed artifacts
  SELECT a.id, a.minio_key, a.mime_type, a.file_name, a.baseline_embedding,
         pc.id AS program_control_id, pc.program_id, o.id AS org_id, o.msp_id
  FROM artifacts a
  JOIN program_controls pc ON a.program_control_id = pc.id
  JOIN programs p ON pc.program_id = p.id
  JOIN orgs o ON p.org_id = o.id
  WHERE a.assessment_status = 'assessed'
    AND a.baseline_embedding IS NOT NULL
    AND a.drift_status != 'dismissed'
    AND a.drift_status != 'drifted'  -- don't re-check already-flagged artifacts
  LIMIT 500  -- batch to avoid overloading the embedding API

Step 2: POST /api/artifacts/batch-drift-check
  (New internal FastAPI endpoint; webhook-secret auth)
  Sends list of artifact IDs; FastAPI handles re-embedding and comparison

Step 3: For each drifted artifact (drift_score > threshold):
  - Update artifacts.drift_status = 'drifted', drift_detected_at = NOW()
  - Update program_controls.has_drifted_evidence = TRUE
  - Generate drift summary via Claude (see below)
  - Send alert email to MSP admin + control assignee (via P1 email infrastructure)
  - Log to artifact_drift_events

Step 4: SPRS recalculation is NOT auto-triggered for drift alone
  (MSP must review and either dismiss or re-assess before SPRS changes)
  This avoids false-positive score changes.
```

**New internal FastAPI endpoint: `POST /api/artifacts/batch-drift-check`**

```python
@router.post("/batch-drift-check")
async def batch_drift_check(
    body: BatchDriftCheckRequest,  # { artifact_ids: list[UUID] }
    x_webhook_secret: str = Header(...),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    For each artifact_id:
    1. Download from MinIO
    2. Re-extract text (extraction_service)
    3. Re-embed (embeddings_service.embed_one on mean chunk)
    4. Compare: drift_score = 1 - cosine_similarity(baseline_embedding, current_embedding)
    5. If drift_score > threshold: flag, generate summary
    Returns: { drifted: [artifact_id], stable: [artifact_id] }
    """
```

### Claude Drift Summary Generation

When drift is detected, generate a human-readable summary:

```python
async def generate_drift_summary(
    artifact_id: UUID,
    baseline_embedding: list[float],
    current_embedding: list[float],
    current_text: str,
    drift_score: float,
    conn: asyncpg.Connection,
) -> str:
    # Fetch original extracted text for comparison
    original_text = await conn.fetchval(
        "SELECT extracted_text FROM artifacts WHERE id = $1", artifact_id
    )

    prompt = f"""
    A compliance artifact has changed since its original assessment.
    The semantic drift score is {drift_score:.2f} (0 = identical, 1 = completely different).

    ORIGINAL TEXT (excerpt, first 2000 chars):
    {original_text[:2000]}

    CURRENT TEXT (excerpt, first 2000 chars):
    {current_text[:2000]}

    In 2-4 sentences, describe what appears to have changed and why it might matter
    for CMMC compliance. Focus on substantive changes, not formatting.
    Be specific about what sections or content appears to have been added or removed.
    """

    # Non-streaming call to OpenRouter
    response = await openrouter_call(prompt, model="anthropic/claude-haiku-4-5")
    return response
```

Model: `claude-haiku-4-5` (fast, cheap — this runs for every drifted artifact nightly).

### Frontend Changes

**Artifact list on control detail (`/[orgSlug]/controls/[id]/page.tsx`):**
- Drifted artifacts show an amber "Drifted" badge
- Expanding the artifact card shows: drift_score (e.g., "38% semantic change"), drift_detected_at, drift_summary text
- Two action buttons: "Dismiss" (with required note) and "Re-assess" (triggers full re-assessment via workflow 02)

**Dashboard alert panel:**
- New amber alert box: "3 artifacts have drifted since assessment. Review recommended."
- Links to the affected controls

**MSP dashboard:**
- New column in org list: "Drift Alerts" count badge (red if > 0)

**New FastAPI endpoints:**
```
POST /api/artifacts/{artifact_id}/dismiss-drift
    Body: { "note": "Minor formatting change only, no substantive change to policy" }

POST /api/artifacts/{artifact_id}/reassess
    Triggers workflow 02 with existing artifact, resets drift_status to 'stable'
```

---

## Thresholds and Tuning

| Drift Score | Meaning | Action |
|-------------|---------|--------|
| < 0.05 | Negligible (formatting, whitespace) | No alert |
| 0.05–0.15 | Minor change | No alert (below default threshold) |
| 0.15–0.30 | Moderate change | Alert, generate summary, flag for review |
| > 0.30 | Major change | Alert, flag as high-risk, recommend re-upload |
| > 0.50 | Content replacement | Auto-demote to `needs_review` in SPRS calculation |

---

## Implementation Phases

**Phase 1 (Days 1-2):** DB migration (artifact columns + drift_events table). Baseline embedding set on assessment-complete webhook. `batch_drift_check` FastAPI endpoint. Cosine distance computation.

**Phase 2 (Day 3):** n8n Workflow 14 (nightly cron). Drift summary generation via Claude. Email alert (P1 infrastructure).

**Phase 3 (Days 4-5):** Frontend: drift badges, summary display, dismiss/re-assess actions. MSP dashboard drift count column.

---

## Acceptance Criteria

- [ ] Baseline embedding is set when an artifact first reaches assessed status
- [ ] Nightly cron runs without errors on 500 artifacts in <5 minutes
- [ ] Drift score correctly identifies a document with 20%+ content removed
- [ ] Drift score < 0.05 for whitespace-only changes (no false positives)
- [ ] Claude drift summary accurately describes what changed (human-validated for 5 test pairs)
- [ ] Dismiss action persists note and prevents re-alerting on the same drift event
- [ ] Re-assess action resets drift_status and triggers fresh Claude assessment
- [ ] MSP email alert arrives within 1 hour of nightly cron detecting drift
- [ ] `artifact_drift_events` records every detection with drift_score
- [ ] All existing pytest tests still pass
