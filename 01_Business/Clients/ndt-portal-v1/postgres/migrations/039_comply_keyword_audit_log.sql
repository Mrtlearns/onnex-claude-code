-- Migration 039: Audit log table for comply keyword library changes
--
-- Every INSERT/UPDATE/DELETE on pipeline.comply_keyword_library is recorded
-- here with the acting user's Authentik UUID, email, and a timestamp.

CREATE TABLE IF NOT EXISTS pipeline.comply_keyword_audit_log (
    id            SERIAL PRIMARY KEY,
    action        TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
    keyword_id    INTEGER,                    -- may be NULL after DELETE
    keyword       TEXT NOT NULL,
    category      TEXT,
    weight        INTEGER,
    description   TEXT,
    changed_by    TEXT NOT NULL,              -- Authentik user UUID (sub claim)
    changed_by_email TEXT NOT NULL DEFAULT '',-- human-readable email for the audit view
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- For UPDATE: what the values were BEFORE the change
    prev_category TEXT,
    prev_weight   INTEGER,
    prev_description TEXT
);

CREATE INDEX idx_kwaudit_changed_at ON pipeline.comply_keyword_audit_log(changed_at DESC);
CREATE INDEX idx_kwaudit_keyword_id ON pipeline.comply_keyword_audit_log(keyword_id);
