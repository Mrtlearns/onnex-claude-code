-- Migration 006: Per-provider API keys and per-step LLM provider/model override

-- 1. Add provider and model columns to inspection steps
ALTER TABLE app.inspection_steps
  ADD COLUMN IF NOT EXISTS provider VARCHAR,
  ADD COLUMN IF NOT EXISTS model    VARCHAR;

-- 2. Seed per-provider settings keys (preserving existing openrouter key)
INSERT INTO ut.app_settings (key, value)
VALUES
  ('openrouter_model',   'openrouter/auto'),
  ('anthropic_model',    'claude-haiku-4-5-20251001'),
  ('openai_model',       'gpt-4o-mini'),
  ('gemini_model',       'gemini-1.5-flash')
ON CONFLICT (key) DO NOTHING;

-- Migrate existing llm_api_key → openrouter_api_key if openrouter is the active provider
INSERT INTO ut.app_settings (key, value)
SELECT 'openrouter_api_key', value
FROM   ut.app_settings
WHERE  key = 'llm_api_key'
  AND  EXISTS (SELECT 1 FROM ut.app_settings WHERE key = 'llm_provider' AND value = 'openrouter')
ON CONFLICT (key) DO NOTHING;
