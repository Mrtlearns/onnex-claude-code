-- Migration 016: C3PAO Audit Package tables
-- P3 — audit package export support

CREATE TABLE IF NOT EXISTS audit_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    status          TEXT DEFAULT 'generating',  -- generating | ready | error
    minio_key       TEXT,                       -- path to ZIP in MinIO cmmc-exports
    file_size_bytes BIGINT,
    sha256_manifest JSONB DEFAULT '{}',         -- { "filename": "sha256hex", ... }
    artifact_count  INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS artifact_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    approved_by     UUID NOT NULL REFERENCES users(id),
    approved_at     TIMESTAMPTZ DEFAULT NOW(),
    approval_note   TEXT,
    UNIQUE (artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_packages_program ON audit_packages (program_id, created_at DESC);
