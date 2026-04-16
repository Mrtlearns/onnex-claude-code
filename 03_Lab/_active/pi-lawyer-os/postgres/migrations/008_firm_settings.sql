-- Migration 008: firm_settings
-- Stores per-firm configuration including LLM provider + model selection.
-- Applied manually: docker exec pilaweros-postgres psql -U postgres -d pilaweros -f /migrations/008_firm_settings.sql

CREATE TABLE IF NOT EXISTS firm_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  llm_provider TEXT NOT NULL DEFAULT 'openrouter',
  llm_model    TEXT NOT NULL DEFAULT 'auto',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (firm_id)
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER firm_settings_updated_at
  BEFORE UPDATE ON firm_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS
ALTER TABLE firm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_settings_isolation ON firm_settings
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON firm_settings TO web_user;

-- Seed default for demo firm
INSERT INTO firm_settings (firm_id, llm_provider, llm_model)
VALUES ('00000000-0000-0000-0000-000000000001', 'openrouter', 'auto')
ON CONFLICT DO NOTHING;
