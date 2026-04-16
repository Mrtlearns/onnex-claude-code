-- PI Lawyer OS — Migration 003: Document AI
-- Phase 3: ai_analyses, demand_letters tables
-- Idempotent (uses IF NOT EXISTS / CREATE OR REPLACE throughout)

-- ============================================================
-- AI Analyses — per-document AI extraction results
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_analyses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis     JSONB NOT NULL DEFAULT '{}',
  status       TEXT DEFAULT 'pending',   -- pending, processing, complete, error
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_analyses_document_id_idx ON ai_analyses(document_id);
CREATE INDEX IF NOT EXISTS ai_analyses_firm_id_idx ON ai_analyses(firm_id);
CREATE INDEX IF NOT EXISTS ai_analyses_status_idx ON ai_analyses(status);

CREATE TRIGGER ai_analyses_updated_at
  BEFORE UPDATE ON ai_analyses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Demand Letters — generated demand letter drafts per case
-- ============================================================

CREATE TABLE IF NOT EXISTS demand_letters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS demand_letters_case_id_idx ON demand_letters(case_id);
CREATE INDEX IF NOT EXISTS demand_letters_firm_id_idx ON demand_letters(firm_id);

CREATE TRIGGER demand_letters_updated_at
  BEFORE UPDATE ON demand_letters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_analyses_isolation ON ai_analyses
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

CREATE POLICY demand_letters_isolation ON demand_letters
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_analyses TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON demand_letters TO web_user;
