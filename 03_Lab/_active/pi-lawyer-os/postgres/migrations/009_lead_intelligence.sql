-- Migration 009: Lead Intelligence
-- Adds pgvector extension, lead scoring, duplicate detection, and case embeddings.
-- Applied manually: docker exec pilaweros-postgres psql -U postgres -d pilaweros -f /migrations/009_lead_intelligence.sql

-- ── pgvector ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Lead intelligence columns ─────────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER,
  ADD COLUMN IF NOT EXISTS lead_score_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID REFERENCES leads(id);

-- ── Case embeddings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_embeddings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  embedding       vector(1536) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id)
);

ALTER TABLE case_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_embeddings_firm_isolation ON case_embeddings
  FOR ALL USING (
    firm_id = (current_setting('request.jwt.claims', true)::json->>'firm_id')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON case_embeddings TO web_user;

-- ── Duplicate detection function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_lead_duplicate(
  p_phone      TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_firm_id    UUID,
  p_self_id    UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  match_id UUID;
BEGIN
  -- Phone match (strongest signal)
  SELECT id INTO match_id
  FROM leads
  WHERE firm_id = p_firm_id
    AND phone = p_phone
    AND status != 'lost'
    AND (p_self_id IS NULL OR id != p_self_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF match_id IS NOT NULL THEN
    RETURN match_id;
  END IF;

  -- Full name match (weaker signal)
  SELECT id INTO match_id
  FROM leads
  WHERE firm_id = p_firm_id
    AND LOWER(first_name) = LOWER(p_first_name)
    AND LOWER(last_name)  = LOWER(p_last_name)
    AND status != 'lost'
    AND (p_self_id IS NULL OR id != p_self_id)
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_lead_duplicate TO web_user;
