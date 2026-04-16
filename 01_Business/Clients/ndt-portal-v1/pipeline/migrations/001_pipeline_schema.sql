-- Pipeline schema: comply, sanitize, gateway tables
-- Idempotent: uses IF NOT EXISTS throughout
-- Run via: docker cp 001_pipeline_schema.sql postgres:/tmp/ && docker exec postgres psql -U ndtapp -d ndtportal -f /tmp/001_pipeline_schema.sql

CREATE SCHEMA IF NOT EXISTS pipeline;

-- ── Comply ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline.comply_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id       UUID NOT NULL,
    filename        TEXT NOT NULL,
    classification  TEXT NOT NULL CHECK (classification IN ('CLEAN','EAR_LOW','EAR_HIGH','ITAR','NEEDS_REVIEW','REJECTED')),
    llm_routing     TEXT NOT NULL CHECK (llm_routing IN ('CLOUD_OK','LOCAL_ONLY','HOLD')),
    risk_score      INTEGER NOT NULL DEFAULT 0,
    cage_codes      TEXT[] DEFAULT '{}',
    usml_hits       JSONB DEFAULT '[]',
    drawing_number  TEXT,
    dist_statement  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline.comply_keyword_library (
    id          SERIAL PRIMARY KEY,
    keyword     TEXT NOT NULL UNIQUE,
    category    TEXT NOT NULL CHECK (category IN ('ITAR','EAR','MIL_SPEC','USML','CAGE')),
    weight      INTEGER NOT NULL DEFAULT 5,
    description TEXT
);

CREATE TABLE IF NOT EXISTS pipeline.comply_cage_code_registry (
    cage_code   CHAR(5) PRIMARY KEY,
    company     TEXT NOT NULL,
    country     CHAR(2) NOT NULL DEFAULT 'US',
    is_defense  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Sanitize ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline.sanitize_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comply_doc_id   UUID REFERENCES pipeline.comply_documents(id),
    entity_count    INTEGER NOT NULL DEFAULT 0,
    input_hash      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline.sanitize_token_vault (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES pipeline.sanitize_jobs(id),
    token           TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    encrypted_val   BYTEA NOT NULL,   -- AES-256-GCM ciphertext
    iv              BYTEA NOT NULL,   -- 12-byte GCM nonce
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, token)
);

CREATE TABLE IF NOT EXISTS pipeline.sanitize_reidentify_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES pipeline.sanitize_jobs(id),
    token           TEXT NOT NULL,
    caller_role     TEXT NOT NULL,
    caller_identity TEXT,
    revealed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Gateway ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline.gateway_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id         UUID,
    sanitize_job_id   UUID REFERENCES pipeline.sanitize_jobs(id),
    provider_used     TEXT NOT NULL CHECK (provider_used IN ('anthropic','ollama','claude_cli','openrouter','openai','gemini')),
    model_used        TEXT NOT NULL,
    classification    TEXT NOT NULL,
    llm_routing       TEXT NOT NULL,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    latency_ms        INTEGER,
    response_json     JSONB,   -- tokens only — never plaintext PII
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline.gateway_reidentify_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_req_id  UUID NOT NULL REFERENCES pipeline.gateway_requests(id),
    caller_role     TEXT NOT NULL,
    tokens_revealed TEXT[] DEFAULT '{}',
    revealed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Intake sessions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline.intake_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msg_filename      TEXT,
    status            TEXT NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing','completed','failed','hold')),
    strictest_routing TEXT CHECK (strictest_routing IN ('CLOUD_OK','LOCAL_ONLY','HOLD')),
    quote_id          UUID,
    result_json       JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_comply_docs_intake    ON pipeline.comply_documents(intake_id);
CREATE INDEX IF NOT EXISTS idx_sanitize_jobs_comply  ON pipeline.sanitize_jobs(comply_doc_id);
CREATE INDEX IF NOT EXISTS idx_vault_job             ON pipeline.sanitize_token_vault(job_id);
CREATE INDEX IF NOT EXISTS idx_gateway_intake        ON pipeline.gateway_requests(intake_id);
CREATE INDEX IF NOT EXISTS idx_intake_status         ON pipeline.intake_sessions(status);

-- ── Grants (allow ndtapp full access to pipeline schema) ──────────────────

GRANT USAGE ON SCHEMA pipeline TO ndtapp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pipeline TO ndtapp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pipeline TO ndtapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline GRANT ALL ON TABLES TO ndtapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA pipeline GRANT ALL ON SEQUENCES TO ndtapp;
