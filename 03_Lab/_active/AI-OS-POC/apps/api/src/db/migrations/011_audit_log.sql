-- Migration: 011_audit_log.sql
-- Phase 11: Audit log table — workspace-global (no tenant_id by design)
-- Idempotent: CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID,
  actor_name   VARCHAR(255),
  action       VARCHAR(100) NOT NULL,
  target_type  VARCHAR(50),
  target_id    UUID,
  target_label VARCHAR(255),
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log (created_at DESC);
