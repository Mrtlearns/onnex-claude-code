-- 002_step_progress.sql
-- Adds step_progress JSONB column to intake_sessions for per-step pipeline tracking.
-- Idempotent: safe to run multiple times.

ALTER TABLE pipeline.intake_sessions
  ADD COLUMN IF NOT EXISTS step_progress JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pipeline.intake_sessions.step_progress IS
  'Array of { key, status, log[], detail, startedAt, completedAt } objects, '
  'one per pipeline step. Status: pending|processing|success|failed|skipped.';
