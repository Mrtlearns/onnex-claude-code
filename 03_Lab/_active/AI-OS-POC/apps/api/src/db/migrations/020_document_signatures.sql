-- Migration 020: Document Signatures — LibreSign integration
-- Tracks e-signature requests initiated from the Nextcloud document browser.

CREATE TABLE IF NOT EXISTS document_signatures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,
  file_path        TEXT NOT NULL,         -- Nextcloud relative path (no leading /)
  file_name        TEXT NOT NULL,
  entity_type      TEXT,                  -- client | project | deal | task (optional link)
  entity_id        UUID,
  signers          JSONB NOT NULL,        -- [{name, email, description?}]
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | partial | completed | expired | cancelled
  libresign_uuid   TEXT,                  -- LibreSign internal document UUID
  signed_file_path TEXT,                  -- path of completed signed PDF in Nextcloud
  initiated_by     TEXT NOT NULL,         -- user sub (UUID as text)
  initiated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS document_signatures_tenant_path_idx
  ON document_signatures (tenant_id, file_path);

CREATE INDEX IF NOT EXISTS document_signatures_tenant_status_idx
  ON document_signatures (tenant_id, status);

CREATE INDEX IF NOT EXISTS document_signatures_entity_idx
  ON document_signatures (tenant_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;
