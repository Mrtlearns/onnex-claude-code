-- Migration: 012_portal.sql
-- Phase 12 plan 03: Client Portal — portal_client_users table
-- Maps Authentik user_id (sub claim) to agency client record
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS

CREATE TABLE IF NOT EXISTS portal_client_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL UNIQUE,  -- Authentik sub claim
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_client_users_user_id
  ON portal_client_users(user_id);

CREATE INDEX IF NOT EXISTS idx_portal_client_users_tenant_client
  ON portal_client_users(tenant_id, client_id);
