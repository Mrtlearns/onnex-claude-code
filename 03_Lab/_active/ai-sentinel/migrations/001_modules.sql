-- Phase 5 Wave 1 — Module lifecycle tables
-- Every pluggable module (rules, optimizer, context-bank, future) is a row in `modules`.
-- Versioned config lives in `module_versions`. Every CRUD op produces a `module_audit` row.

CREATE TABLE IF NOT EXISTS modules (
    id               BIGSERIAL   PRIMARY KEY,
    kind             TEXT        NOT NULL,   -- 'rules' | 'optimizer' | 'context_bank'
    name             TEXT        NOT NULL,
    description      TEXT        NOT NULL DEFAULT '',
    enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
    current_version  INTEGER     NOT NULL DEFAULT 1,
    license_tier     TEXT        NOT NULL DEFAULT 'basic',  -- 'basic' | 'pro' | 'enterprise'
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(kind, name)
);

CREATE INDEX IF NOT EXISTS idx_modules_kind_enabled ON modules(kind, enabled);

CREATE TABLE IF NOT EXISTS module_versions (
    id            BIGSERIAL   PRIMARY KEY,
    module_id     BIGINT      NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    version       INTEGER     NOT NULL,
    config_yaml   TEXT        NOT NULL,
    config_hash   TEXT        NOT NULL,            -- sha256(config_yaml)
    created_by    TEXT        NOT NULL,            -- actor (admin token subject / future user id)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(module_id, version)
);

CREATE INDEX IF NOT EXISTS idx_module_versions_module ON module_versions(module_id, version DESC);

CREATE TABLE IF NOT EXISTS module_audit (
    id              BIGSERIAL   PRIMARY KEY,
    prev_hash       TEXT        NOT NULL,
    record_hash     TEXT        NOT NULL,
    module_id       BIGINT      REFERENCES modules(id) ON DELETE SET NULL,
    action          TEXT        NOT NULL,   -- 'create' | 'update' | 'enable' | 'disable' | 'revert' | 'delete'
    actor           TEXT        NOT NULL,
    "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    before_version  INTEGER,
    after_version   INTEGER,
    diff_json       JSONB
);

CREATE INDEX IF NOT EXISTS idx_module_audit_module_ts ON module_audit(module_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_module_audit_actor_ts  ON module_audit(actor, "timestamp" DESC);
