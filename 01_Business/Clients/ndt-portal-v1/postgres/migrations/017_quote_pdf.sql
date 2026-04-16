-- Migration 017: Quote PDF versioning + audit log

ALTER TABLE ut.incoming_quotes
    ADD COLUMN IF NOT EXISTS pdf_path    TEXT,
    ADD COLUMN IF NOT EXISTS pdf_version INT NOT NULL DEFAULT 0;

ALTER TABLE rt.incoming_quotes
    ADD COLUMN IF NOT EXISTS pdf_path    TEXT,
    ADD COLUMN IF NOT EXISTS pdf_version INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS app.quote_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id    UUID NOT NULL,
    quote_type  TEXT NOT NULL CHECK (quote_type IN ('ut','rt')),
    changed_by  TEXT NOT NULL DEFAULT 'system',
    change_type TEXT NOT NULL,
    diff        JSONB,
    pdf_version INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_audit_log_quote_id
    ON app.quote_audit_log (quote_id);
