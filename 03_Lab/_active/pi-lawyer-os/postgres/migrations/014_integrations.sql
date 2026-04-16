-- Migration 014: add integrations_config JSONB column to firms
ALTER TABLE firms ADD COLUMN IF NOT EXISTS integrations_config JSONB DEFAULT '{}' NOT NULL;
