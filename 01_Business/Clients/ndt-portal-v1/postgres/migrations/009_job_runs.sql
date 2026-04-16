-- Migration 009: Job run tracking table
-- Tracks every background job execution (sf_sync, future jobs)
-- with timing, status, and result summary for the Admin → Jobs dashboard.

CREATE TABLE IF NOT EXISTS app.job_runs (
  id                SERIAL PRIMARY KEY,
  job_name          TEXT NOT NULL,          -- 'sf_sync', extensible for future jobs
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  duration_ms       INTEGER,                -- wall-clock ms
  status            TEXT NOT NULL DEFAULT 'running',  -- running | success | error
  records_upserted  JSONB,                  -- {"accounts":2266,"jobs":53,"quotes":12,...}
  summary           TEXT,                   -- human-readable one-liner
  error             TEXT                    -- NULL on success, traceback on error
);

CREATE INDEX IF NOT EXISTS job_runs_name_idx    ON app.job_runs(job_name);
CREATE INDEX IF NOT EXISTS job_runs_started_idx ON app.job_runs(started_at DESC);
