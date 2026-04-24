-- Phase 5 Wave 1 — Token Optimizer cache persistence
-- In-memory DashMap is primary; this table is a warmup snapshot for restart recovery.
-- Written opportunistically (batch on SIGTERM, or every N minutes).

CREATE TABLE IF NOT EXISTS cache_entries (
    id                BIGSERIAL    PRIMARY KEY,
    cache_key         BIGINT       NOT NULL UNIQUE,  -- u64 blake3 truncated (stored as BIGINT with cast)
    prompt_hash       TEXT         NOT NULL,
    model             TEXT         NOT NULL,
    temperature       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    response_blob     BYTEA        NOT NULL,         -- bincoded CachedResponse
    hit_count         INTEGER      NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_accessed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_last_accessed ON cache_entries(last_accessed_at DESC);
