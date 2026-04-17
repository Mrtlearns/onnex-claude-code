-- Migration 019: Nextcloud RAG — chunk store, knowledge graph, API keys
-- Extends the proven Paperless→pgvector pattern to Nextcloud content.
-- Column MUST be named "text" — LangChain PGVector hardcodes this.

-- ── Chunk store ───────────────────────────────────────────────────────────────
-- Custom columns have DEFAULT '' so LangChain PGVector inserts work cleanly.
-- A BEFORE INSERT trigger backfills them from the metadata JSONB column.
CREATE TABLE IF NOT EXISTS nextcloud_rag_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text         TEXT NOT NULL,
  embedding    VECTOR(1536),
  folder_scope TEXT NOT NULL DEFAULT '',
  file_path    TEXT NOT NULL DEFAULT '',
  file_name    TEXT NOT NULL DEFAULT '',
  file_ext     TEXT,
  tenant_id    TEXT NOT NULL DEFAULT 'default',
  metadata     JSONB DEFAULT '{}',
  ingested_at  TIMESTAMPTZ DEFAULT now()
);

-- Trigger: populate custom columns from metadata JSONB when LangChain inserts rows
CREATE OR REPLACE FUNCTION nc_chunks_populate_from_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folder_scope = '' THEN
    NEW.folder_scope := COALESCE(NEW.metadata->>'folder_scope', '');
  END IF;
  IF NEW.file_path = '' THEN
    NEW.file_path := COALESCE(NEW.metadata->>'file_path', '');
  END IF;
  IF NEW.file_name = '' THEN
    NEW.file_name := COALESCE(NEW.metadata->>'file_name', '');
  END IF;
  IF NEW.file_ext IS NULL THEN
    NEW.file_ext := NEW.metadata->>'file_ext';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nc_chunks_auto_populate ON nextcloud_rag_chunks;
CREATE TRIGGER nc_chunks_auto_populate
  BEFORE INSERT ON nextcloud_rag_chunks
  FOR EACH ROW EXECUTE FUNCTION nc_chunks_populate_from_metadata();

CREATE INDEX IF NOT EXISTS idx_nc_chunks_embedding
  ON nextcloud_rag_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_nc_chunks_scope
  ON nextcloud_rag_chunks (folder_scope);
CREATE INDEX IF NOT EXISTS idx_nc_chunks_tenant
  ON nextcloud_rag_chunks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_nc_chunks_file
  ON nextcloud_rag_chunks (file_path);

-- ── Knowledge graph — entities ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kg_entities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL DEFAULT 'default',
  entity_type  TEXT NOT NULL,
  name         TEXT NOT NULL,
  aliases      TEXT[] DEFAULT '{}',
  properties   JSONB DEFAULT '{}',
  source_paths TEXT[] DEFAULT '{}',
  folder_scope TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_kg_entities_tenant
  ON kg_entities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_type
  ON kg_entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_name
  ON kg_entities USING gin (to_tsvector('english', name));

-- ── Knowledge graph — relationships ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kg_relationships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL DEFAULT 'default',
  from_id      UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  to_id        UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  rel_type     TEXT NOT NULL,
  weight       FLOAT DEFAULT 1.0,
  context      TEXT,
  source_path  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kg_rels_from
  ON kg_relationships (from_id);
CREATE INDEX IF NOT EXISTS idx_kg_rels_to
  ON kg_relationships (to_id);
CREATE INDEX IF NOT EXISTS idx_kg_rels_tenant
  ON kg_relationships (tenant_id);

-- ── API keys for external callers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  tenant_id    TEXT NOT NULL DEFAULT 'default',
  scopes       TEXT[] DEFAULT '{"rag:query"}',
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
