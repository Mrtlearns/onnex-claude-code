-- Migration 015: AI Brain job runs
CREATE TABLE IF NOT EXISTS brain_job_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL DEFAULT 'default',
  sop_slug     TEXT NOT NULL,
  sop_title    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running'
               CHECK (status IN ('running', 'completed', 'failed')),
  input        JSONB,
  output       TEXT,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS brain_job_runs_tenant_started_idx ON brain_job_runs (tenant_id, started_at DESC);
