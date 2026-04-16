-- ============================================================
-- Migration: app schema — inspection_types + inspection_steps
-- Idempotent: safe to run multiple times
-- ============================================================

CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO anon, authenticated;

CREATE TABLE IF NOT EXISTS app.inspection_types (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR NOT NULL UNIQUE,
  label       VARCHAR NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.inspection_steps (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type_id   UUID    NOT NULL REFERENCES app.inspection_types(id) ON DELETE CASCADE,
  name                 VARCHAR NOT NULL,
  action_type          VARCHAR NOT NULL,
  instruction          TEXT,
  python_code          TEXT,
  n8n_workflow         VARCHAR,
  webhook_url          VARCHAR,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Add webhook_url if missing (idempotent column add)
ALTER TABLE app.inspection_steps ADD COLUMN IF NOT EXISTS webhook_url VARCHAR;

-- Enforce action_type values (drop old constraint first so we can widen it)
ALTER TABLE app.inspection_steps DROP CONSTRAINT IF EXISTS inspection_steps_action_type_check;
ALTER TABLE app.inspection_steps ADD CONSTRAINT inspection_steps_action_type_check
  CHECK (action_type IN ('llm', 'python', 'n8n', 'webhook'));

GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon, authenticated;

-- ============================================================
-- Seed: NDT inspection types (upsert by code)
-- ============================================================
INSERT INTO app.inspection_types (code, label, description, sort_order) VALUES
  ('ET', 'Electromagnetic Testing',
   'Detects surface and near-surface discontinuities using eddy currents or other electromagnetic techniques. Effective on conductive materials without requiring direct contact.',
   1),
  ('MT', 'Magnetic Particle Testing',
   'Reveals surface and near-surface flaws in ferromagnetic materials by applying magnetic fields and iron particles that accumulate at flux leakage points.',
   2),
  ('PT', 'Liquid Penetrant Testing',
   'Reveals surface-breaking defects through capillary action of dye or fluorescent penetrant. Applicable to non-porous metallic and non-metallic materials.',
   3),
  ('RT', 'Radiographic Testing',
   'Uses X-rays or gamma rays to detect internal voids, inclusions, and discontinuities through differential absorption recorded on film or a digital detector.',
   4),
  ('UT', 'Ultrasonic Testing',
   'Uses high-frequency sound waves to detect and measure internal flaws, wall thickness, and material properties via pulse-echo or through-transmission techniques.',
   5),
  ('VT', 'Visual Testing',
   'Direct or aided visual examination of surfaces to detect cracks, corrosion, misalignment, missing hardware, and workmanship defects. The most fundamental NDT method.',
   6)
ON CONFLICT (code) DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = now();

-- ============================================================
-- Migration: rt.analysis_jobs — two-stage LLM RT analysis
-- Idempotent: safe to run multiple times
-- ============================================================

CREATE TABLE IF NOT EXISTS rt.analysis_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          UUID        REFERENCES rt.part_quotes(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  -- status: pending | classifying | assembling | analyzing | validating | complete | failed
  stage             TEXT,
  file_name         TEXT,
  file_hash         TEXT,
  comply_result     JSONB,
  classification    JSONB,
  analysis          JSONB,
  sanitize_job_id   TEXT,
  llm_routing       TEXT,
  low_confidence    BOOLEAN     NOT NULL DEFAULT false,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_quote  ON rt.analysis_jobs(quote_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON rt.analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created ON rt.analysis_jobs(created_at DESC);

GRANT SELECT,INSERT,UPDATE,DELETE ON rt.analysis_jobs TO anon, authenticated;

-- ============================================================
-- Seed: one step of each action type per inspection type
-- ============================================================
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id, code FROM app.inspection_types WHERE code IN ('ET','MT','PT','RT','UT','VT') LOOP

    -- LLM step
    INSERT INTO app.inspection_steps
      (inspection_type_id, name, action_type, instruction, sort_order)
    SELECT
      t.id,
      t.code || ' — Extract & Classify (LLM)',
      'llm',
      'You are an NDT data extraction assistant. Extract relevant inspection parameters from the '
      'provided document or email for a ' || t.code || ' inspection job. '
      'Return a JSON object with keys: customer, part_number, material, quantity, specification, special_requirements.',
      0
    WHERE NOT EXISTS (
      SELECT 1 FROM app.inspection_steps
      WHERE inspection_type_id = t.id AND action_type = 'llm'
    );

    -- Python step
    INSERT INTO app.inspection_steps
      (inspection_type_id, name, action_type, python_code, sort_order)
    SELECT
      t.id,
      t.code || ' — Validate & Transform (Python)',
      'python',
      '# Input: ctx dict with data from the previous step' || chr(10) ||
      '# Output: return a validated dict' || chr(10) || chr(10) ||
      'result = {' || chr(10) ||
      '    "customer":    ctx.get("customer", "").strip().upper(),' || chr(10) ||
      '    "part_number": ctx.get("part_number", ""),' || chr(10) ||
      '    "quantity":    int(ctx.get("quantity", 1)),' || chr(10) ||
      '    "method":      "' || t.code || '",' || chr(10) ||
      '    "valid":       bool(ctx.get("part_number") and ctx.get("customer")),' || chr(10) ||
      '}' || chr(10) ||
      'return result',
      1
    WHERE NOT EXISTS (
      SELECT 1 FROM app.inspection_steps
      WHERE inspection_type_id = t.id AND action_type = 'python'
    );

    -- n8n step
    INSERT INTO app.inspection_steps
      (inspection_type_id, name, action_type, n8n_workflow, sort_order)
    SELECT
      t.id,
      t.code || ' — Route & Notify (n8n)',
      'n8n',
      'NDT ' || t.code || ' Job Router',
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM app.inspection_steps
      WHERE inspection_type_id = t.id AND action_type = 'n8n'
    );

    -- Webhook step
    INSERT INTO app.inspection_steps
      (inspection_type_id, name, action_type, webhook_url, sort_order)
    SELECT
      t.id,
      t.code || ' — Post to ERP (Webhook)',
      'webhook',
      'https://erp.example.com/api/ndt-jobs/inbound',
      3
    WHERE NOT EXISTS (
      SELECT 1 FROM app.inspection_steps
      WHERE inspection_type_id = t.id AND action_type = 'webhook'
    );

  END LOOP;
END $$;

-- ============================================================
-- Migration: Claude OAuth token management
-- Stores token metadata in ut.app_settings (key-value)
-- Idempotent: safe to run multiple times
-- ============================================================

ALTER TABLE ut.app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

INSERT INTO ut.app_settings (key, value) VALUES
  ('claude_oauth_token',           ''),
  ('claude_oauth_token_preview',   ''),
  ('claude_oauth_saved_at',        ''),
  ('claude_oauth_verified_at',     ''),
  ('claude_oauth_verified_status', 'unknown'),
  ('claude_oauth_expires_approx',  ''),
  ('claude_oauth_notes',           '')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Migration: LLM auth method toggle
-- oauth_cli = use claude CLI with OAuth token (default)
-- api_key   = use provider API key directly
-- ============================================================

INSERT INTO ut.app_settings (key, value) VALUES
  ('llm_auth_method', 'oauth_cli')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Migration: Widen gateway_requests provider_used constraint
-- Adds claude_cli, openrouter, openai, gemini as valid providers
-- ============================================================

ALTER TABLE pipeline.gateway_requests
  DROP CONSTRAINT IF EXISTS gateway_requests_provider_used_check;

ALTER TABLE pipeline.gateway_requests
  ADD CONSTRAINT gateway_requests_provider_used_check
  CHECK (provider_used IN ('anthropic','ollama','claude_cli','openrouter','openai','gemini'));

-- Bypass sanitize_job record for non-pipeline LLM calls (e.g. SF Chat)
-- Must exist before gateway_requests FK constraint can be satisfied for direct calls.
INSERT INTO pipeline.sanitize_jobs (id, entity_count, input_hash)
VALUES ('00000000-0000-0000-0000-000000000001', 0, 'sf-chat-bypass')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Migration: UT quotes — standard/spec and rush level fields
-- Idempotent: safe to run multiple times
-- ============================================================

ALTER TABLE ut.incoming_quotes
  ADD COLUMN IF NOT EXISTS standard          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS rush_level        VARCHAR(20)  NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS rush_multiplier   DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS rush_surcharge    DECIMAL(10,2) NOT NULL DEFAULT 0.00;
