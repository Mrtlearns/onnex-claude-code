-- Migration 012: pgvector embeddings for Evidence RAG + Cross-Control Reuse
-- Idempotent — safe to re-run

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- artifact_chunks — paragraph-level text chunks with embeddings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifact_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    chunk_text      TEXT NOT NULL,
    page_number     INTEGER NOT NULL DEFAULT 1,
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (artifact_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_artifact_chunks_artifact_id
    ON artifact_chunks (artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_chunks_embedding
    ON artifact_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- ---------------------------------------------------------------------------
-- control_definition_embeddings — semantic vectors for each control
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS control_definition_embeddings (
    control_definition_id   UUID PRIMARY KEY REFERENCES control_definitions(id) ON DELETE CASCADE,
    requirement_embedding   vector(1536),
    guidance_embedding      vector(1536),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cde_req_embedding
    ON control_definition_embeddings USING ivfflat (requirement_embedding vector_cosine_ops)
    WITH (lists = 50);

-- ---------------------------------------------------------------------------
-- artifact_control_suggestions — cached cosine-similarity matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifact_control_suggestions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id             UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    control_definition_id   UUID NOT NULL REFERENCES control_definitions(id) ON DELETE CASCADE,
    similarity_score        FLOAT NOT NULL,
    top_chunk_texts         TEXT[] NOT NULL DEFAULT '{}',
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (artifact_id, control_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_acs_artifact_id
    ON artifact_control_suggestions (artifact_id);

CREATE INDEX IF NOT EXISTS idx_acs_similarity
    ON artifact_control_suggestions (artifact_id, similarity_score DESC);
