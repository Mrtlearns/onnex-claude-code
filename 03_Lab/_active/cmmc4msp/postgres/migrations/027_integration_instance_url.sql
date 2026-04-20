-- Migration 027: Add instance_url to integrations table
-- Allows per-integration configuration of self-hosted provider endpoints (e.g. Splunk).

ALTER TABLE integrations ADD COLUMN IF NOT EXISTS instance_url TEXT;
