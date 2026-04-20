CREATE TABLE IF NOT EXISTS control_gap_analyses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_control_id  UUID NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    requested_by        UUID NOT NULL REFERENCES users(id),
    status              TEXT DEFAULT 'generating',  -- generating | ready | error | stale
    objectives_covered  INT,
    objectives_total    INT,
    coverage_pct        FLOAT,
    gap_report          JSONB DEFAULT '{}',
    overall_assessment  TEXT,
    suggested_next_upload TEXT,
    model_used          TEXT,
    artifact_ids_analyzed UUID[],
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gap_analyses_pc ON control_gap_analyses (program_control_id, created_at DESC);
