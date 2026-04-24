-- Phase 5 Wave 1 — Pipeline audit chain (replaces in-memory L7)
-- Single tamper-evident SHA-256 hash chain. Writes are durable.
-- Verification: walk rows in insert order, recompute hash, compare to stored record_hash.

CREATE TABLE IF NOT EXISTS audit_records (
    id            BIGSERIAL    PRIMARY KEY,
    prev_hash     TEXT         NOT NULL,
    record_hash   TEXT         NOT NULL UNIQUE,
    payload_hash  TEXT         NOT NULL,
    "timestamp"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    direction     TEXT         NOT NULL,
    decision      TEXT         NOT NULL,
    layer         TEXT,
    code          TEXT,
    caller_id     TEXT         NOT NULL,
    session_id    TEXT,
    request_id    TEXT         NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_records_ts      ON audit_records("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_records_caller  ON audit_records(caller_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_records_request ON audit_records(request_id);
