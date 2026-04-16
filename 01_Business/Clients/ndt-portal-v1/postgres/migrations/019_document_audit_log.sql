-- Migration 019: Document audit log table
-- Tracks all document operations: upload, mkdir, soft-delete, hard-delete, purge.

CREATE TABLE IF NOT EXISTS app.document_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,  -- 'upload' | 'mkdir' | 'delete_soft' | 'delete_hard' | 'purge'
  path        TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'system',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_created ON app.document_audit_log(created_at);
