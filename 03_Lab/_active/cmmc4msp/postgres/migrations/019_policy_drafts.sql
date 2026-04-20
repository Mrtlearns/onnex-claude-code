-- Migration 019: Policy Drafts — AI-generated remediation policy documents
CREATE TABLE IF NOT EXISTS policy_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_control_id  UUID NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    generated_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'draft',
    content_markdown    TEXT NOT NULL,
    content_hash        TEXT,
    minio_key           TEXT,
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    reviewer_notes      TEXT,
    model_used          TEXT,
    generation_params   JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_drafts_pc ON policy_drafts (program_control_id, created_at DESC);
