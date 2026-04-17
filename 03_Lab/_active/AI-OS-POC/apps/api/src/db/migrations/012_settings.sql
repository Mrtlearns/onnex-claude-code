-- Migration: 012_settings.sql
-- Phase 12: Workspace settings — key-value store for all configuration
-- Idempotent: CREATE TABLE IF NOT EXISTS / INSERT ... ON CONFLICT DO NOTHING

CREATE TABLE IF NOT EXISTS workspace_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default workspace profile row (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO workspace_settings (key, value)
VALUES (
  'workspace',
  '{"name":"Agency AI-OS","logo_url":null,"timezone":"America/Los_Angeles","default_currency":"USD"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
