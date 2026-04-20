-- Migration 026: Triage tenant scope hardening
-- Backfill msp_id on error_events from their parent org's MSP.
-- Add a per-MSP partial index to speed up nightly fan-out query.
-- Also backfills triage_reports msp_id where NULL (old nightly runs before this fix).

BEGIN;

-- 1. Backfill error_events.msp_id from orgs.msp_id where still NULL
UPDATE error_events ee
SET msp_id = o.msp_id
FROM orgs o
WHERE ee.org_id = o.id
  AND ee.msp_id IS NULL
  AND o.msp_id IS NOT NULL;

-- 2. Per-MSP untriaged index (used by nightly fan-out and /api/triage/latest)
CREATE INDEX IF NOT EXISTS idx_error_events_msp_untriaged
    ON error_events (msp_id, created_at DESC)
    WHERE triaged = FALSE;

-- 3. Triage reports backfill: set msp_id from first linked event's msp_id
--    (best-effort for rows created before this migration)
UPDATE triage_reports tr
SET msp_id = sub.msp_id
FROM (
    SELECT DISTINCT ON (triaged_by_report_id)
        triaged_by_report_id,
        msp_id
    FROM error_events
    WHERE triaged_by_report_id IS NOT NULL
      AND msp_id IS NOT NULL
) sub
WHERE tr.id = sub.triaged_by_report_id
  AND tr.msp_id IS NULL;

COMMIT;
