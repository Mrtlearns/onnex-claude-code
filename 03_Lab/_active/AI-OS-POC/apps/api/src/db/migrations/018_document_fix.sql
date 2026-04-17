-- Migration 018: Fix document_links tenant_id type + add folder support + document_comments
-- tenant_id was UUID NOT NULL — Authentik JWTs carry no UUID claim, so it always failed

-- Fix 1: Change tenant_id from UUID to TEXT (root cause of "Failed to link document" toast)
ALTER TABLE document_links ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
ALTER TABLE document_links ALTER COLUMN tenant_id SET DEFAULT 'default';

-- Fix 2: Add link_type + display_name for folder support
ALTER TABLE document_links ADD COLUMN IF NOT EXISTS link_type TEXT NOT NULL DEFAULT 'file'
  CHECK (link_type IN ('file', 'folder'));
ALTER TABLE document_links ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Fix 3: Document comments table
CREATE TABLE IF NOT EXISTS document_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL DEFAULT 'default',
  document_source VARCHAR(20) NOT NULL,
  document_id     VARCHAR(255) NOT NULL,
  entity_type     VARCHAR(20) NOT NULL,
  entity_id       UUID NOT NULL,
  author_id       TEXT NOT NULL,
  author_name     TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_comments_doc_entity_idx
  ON document_comments (document_source, document_id, entity_type, entity_id, created_at DESC);
