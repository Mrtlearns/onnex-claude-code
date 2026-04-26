-- Document audit log for delete/purge operations
CREATE TABLE IF NOT EXISTS document_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT        NOT NULL,   -- 'soft_delete' | 'hard_delete' | 'purge'
  path        TEXT        NOT NULL,
  actor       TEXT        DEFAULT 'system',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_created ON document_audit_log(created_at);

-- Named folder references for AI-OS tools that need named Nextcloud paths
CREATE TABLE IF NOT EXISTS folder_references (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alias           TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  nextcloud_path  TEXT        NOT NULL,
  description     TEXT,
  is_active       BOOLEAN     DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_refs_alias_active
  ON folder_references(alias) WHERE is_active = TRUE;
