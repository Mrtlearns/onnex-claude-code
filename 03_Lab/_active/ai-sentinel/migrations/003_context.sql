-- Phase 5 Wave 1 — Context Bank tables (pgvector)
-- Model-agnostic conversation storage. Embedding dim 768 = nomic-embed-text (Ollama).
-- If a future embedder needs a different dim, create a fresh table + migrate.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS context_entries (
    id           BIGSERIAL    PRIMARY KEY,
    caller_id    TEXT         NOT NULL,
    session_id   TEXT,
    role         TEXT         NOT NULL,            -- 'user' | 'assistant' | 'tool' | 'system'
    content      TEXT         NOT NULL,
    embedding    vector(768),                      -- NULL until background embedder runs
    token_count  INTEGER      NOT NULL DEFAULT 0,
    summarized   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_entries_caller_ts ON context_entries(caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_entries_needs_embed ON context_entries(created_at) WHERE embedding IS NULL;
CREATE INDEX IF NOT EXISTS idx_context_entries_unsummarized ON context_entries(caller_id, created_at) WHERE summarized = FALSE;

-- HNSW index for cosine similarity (created after table has data; safe to create empty).
CREATE INDEX IF NOT EXISTS idx_context_entries_embedding
    ON context_entries USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS context_summaries (
    id                 BIGSERIAL    PRIMARY KEY,
    caller_id          TEXT         NOT NULL,
    summary_text       TEXT         NOT NULL,
    summary_embedding  vector(768),
    source_entry_ids   BIGINT[]     NOT NULL,
    entry_count        INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_summaries_caller_ts ON context_summaries(caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_summaries_embedding
    ON context_summaries USING hnsw (summary_embedding vector_cosine_ops);
