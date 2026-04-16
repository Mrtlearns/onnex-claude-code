-- Knowledge Universe — Initial Schema
-- Schema: poc_personal_to_do

CREATE SCHEMA IF NOT EXISTS poc_personal_to_do;

-- Nodes table
CREATE TABLE IF NOT EXISTS poc_personal_to_do.nodes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT,
  type        TEXT NOT NULL DEFAULT 'note',
  status      TEXT NOT NULL DEFAULT 'fresh',
  x           REAL NOT NULL DEFAULT 0,
  y           REAL NOT NULL DEFAULT 0,
  z           REAL NOT NULL DEFAULT 0,
  color       TEXT,
  tags        JSONB DEFAULT '[]'::jsonb,
  metadata    JSONB DEFAULT '{}'::jsonb,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_status   ON poc_personal_to_do.nodes (status);
CREATE INDEX IF NOT EXISTS idx_nodes_type     ON poc_personal_to_do.nodes (type);
CREATE INDEX IF NOT EXISTS idx_nodes_archived ON poc_personal_to_do.nodes (archived);

-- Edges table
CREATE TABLE IF NOT EXISTS poc_personal_to_do.edges (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES poc_personal_to_do.nodes(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES poc_personal_to_do.nodes(id) ON DELETE CASCADE,
  label       TEXT,
  type        TEXT NOT NULL DEFAULT 'relates_to',
  strength    REAL NOT NULL DEFAULT 1.0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON poc_personal_to_do.edges (source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON poc_personal_to_do.edges (target_id);

-- Node attachments table
CREATE TABLE IF NOT EXISTS poc_personal_to_do.node_attachments (
  id           TEXT PRIMARY KEY,
  node_id      TEXT NOT NULL REFERENCES poc_personal_to_do.nodes(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   INTEGER,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_attachments_node ON poc_personal_to_do.node_attachments (node_id);

-- Action logs table
CREATE TABLE IF NOT EXISTS poc_personal_to_do.action_logs (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  payload     JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_entity    ON poc_personal_to_do.action_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_created   ON poc_personal_to_do.action_logs (created_at);
