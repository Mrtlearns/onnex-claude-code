-- Migration 003: LLM settings key-value store
-- Creates ut.app_settings table and seeds default LLM config.
-- Safe to run multiple times (IF NOT EXISTS + ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS ut.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default LLM settings
INSERT INTO ut.app_settings (key, value) VALUES
    ('llm_provider', 'openrouter'),
    ('llm_model',    'openrouter/auto'),
    ('llm_api_key',  '')
ON CONFLICT (key) DO NOTHING;
