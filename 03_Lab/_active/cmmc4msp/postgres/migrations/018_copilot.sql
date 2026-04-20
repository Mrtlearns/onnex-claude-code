-- Migration 018: Compliance Copilot
-- Adds per-control AI chat message history and NIST SP 800-171A guide chunk store.

CREATE TABLE IF NOT EXISTS control_chat_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_control_id  UUID NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content             TEXT NOT NULL,
    cited_artifact_ids  UUID[],
    cited_chunk_ids     UUID[],
    model_used          TEXT,
    tokens_used         INT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_pc ON control_chat_messages (program_control_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nist_guide_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nist_id         TEXT NOT NULL,
    section         TEXT,
    chunk_text      TEXT NOT NULL,
    chunk_index     INT NOT NULL DEFAULT 0,
    embedding       VECTOR(1536),
    UNIQUE (nist_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_nist_chunks_embedding ON nist_guide_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
