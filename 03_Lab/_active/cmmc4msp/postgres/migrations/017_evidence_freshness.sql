-- Migration 017: Evidence Freshness Monitoring (P4)
-- Adds freshness tracking columns and a view to report control evidence age.

ALTER TABLE control_definitions ADD COLUMN IF NOT EXISTS evidence_max_age_days INT DEFAULT NULL;
ALTER TABLE program_controls ADD COLUMN IF NOT EXISTS last_evidence_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE program_controls ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE program_controls ADD COLUMN IF NOT EXISTS stale_since TIMESTAMPTZ DEFAULT NULL;

-- Seed evidence_max_age_days per NIST family (representative values)
UPDATE control_definitions SET evidence_max_age_days = 30  WHERE nist_id LIKE '3.11.%'; -- Risk Assessment: vulnerability scans
UPDATE control_definitions SET evidence_max_age_days = 90  WHERE nist_id LIKE '3.1.%';  -- Access Control: access reviews
UPDATE control_definitions SET evidence_max_age_days = 90  WHERE nist_id LIKE '3.9.%';  -- Personnel: background checks
UPDATE control_definitions SET evidence_max_age_days = 365 WHERE nist_id LIKE '3.12.%'; -- Security Assessment: annual reviews
UPDATE control_definitions SET evidence_max_age_days = 365 WHERE nist_id LIKE '3.2.%';  -- Awareness and Training
UPDATE control_definitions SET evidence_max_age_days = 365 WHERE nist_id LIKE '3.13.%'; -- System Protection
-- Remaining families default to NULL (no expiry)

-- View: freshness status per control
CREATE OR REPLACE VIEW program_control_freshness AS
SELECT
    pc.id,
    pc.program_id,
    pc.status,
    pc.last_evidence_at,
    pc.expires_at,
    pc.stale_since,
    cd.nist_id,
    cd.evidence_max_age_days,
    CASE
        WHEN cd.evidence_max_age_days IS NULL THEN 'no_expiry'
        WHEN pc.last_evidence_at IS NULL THEN 'no_evidence'
        WHEN pc.expires_at < NOW() THEN 'expired'
        WHEN pc.expires_at < NOW() + INTERVAL '14 days' THEN 'expiring_soon'
        ELSE 'fresh'
    END AS freshness_status
FROM program_controls pc
JOIN control_definitions cd ON pc.control_definition_id = cd.id;
