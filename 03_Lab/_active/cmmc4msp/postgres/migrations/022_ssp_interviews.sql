CREATE TABLE IF NOT EXISTS ssp_interviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    started_by      UUID NOT NULL REFERENCES users(id),
    status          TEXT DEFAULT 'in_progress',  -- in_progress | completed | abandoned | awaiting_review
    responses       JSONB DEFAULT '{}',
    generated_sections JSONB DEFAULT '{}',
    sections_reviewed JSONB DEFAULT '{}',
    reviewer_notes  JSONB DEFAULT '{}',
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssp_interviews_program ON ssp_interviews (program_id, created_at DESC);
