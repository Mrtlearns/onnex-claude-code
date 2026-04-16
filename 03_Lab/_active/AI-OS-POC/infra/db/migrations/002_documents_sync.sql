-- 002_documents_sync.sql
CREATE TABLE IF NOT EXISTS documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename                TEXT NOT NULL,
  nextcloud_url           TEXT,
  paperless_id            INTEGER UNIQUE,
  paperless_title         TEXT,
  paperless_tags          TEXT[],
  paperless_correspondent TEXT,
  memory_entry_id         UUID,
  tenant_id               TEXT NOT NULL DEFAULT 'system',
  created_at              TIMESTAMPTZ DEFAULT now(),
  synced_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS documents_paperless_id_idx ON documents (paperless_id);
CREATE INDEX IF NOT EXISTS documents_tenant_id_idx ON documents (tenant_id);

CREATE TABLE IF NOT EXISTS sync_cursors (
  source      TEXT PRIMARY KEY,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);

INSERT INTO sync_cursors (source) VALUES ('paperless')
  ON CONFLICT (source) DO NOTHING;
