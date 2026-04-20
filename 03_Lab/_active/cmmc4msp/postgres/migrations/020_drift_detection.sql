-- Migration 020: Evidence Drift Detection (A3)
-- Adds embedding columns, drift tracking fields, and drift events table.

ALTER TABLE artifacts
    ADD COLUMN IF NOT EXISTS baseline_embedding     VECTOR(1536),
    ADD COLUMN IF NOT EXISTS current_embedding      VECTOR(1536),
    ADD COLUMN IF NOT EXISTS baseline_embedding_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS drift_score            FLOAT,
    ADD COLUMN IF NOT EXISTS drift_status           TEXT DEFAULT 'stable',
    ADD COLUMN IF NOT EXISTS drift_detected_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS drift_summary          TEXT,
    ADD COLUMN IF NOT EXISTS drift_dismissed_by     UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS drift_dismissed_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS drift_dismiss_note     TEXT;

ALTER TABLE program_controls
    ADD COLUMN IF NOT EXISTS has_drifted_evidence BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS artifact_drift_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    drift_score     FLOAT NOT NULL,
    drift_summary   TEXT,
    model_used      TEXT,
    detected_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolution      TEXT
);

CREATE INDEX IF NOT EXISTS idx_drift_events_artifact ON artifact_drift_events (artifact_id, detected_at DESC);
