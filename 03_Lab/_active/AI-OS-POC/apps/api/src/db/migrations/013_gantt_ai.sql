-- Migration 013: Gantt chart fields, AI task pickup fields, task dependencies
-- Idempotent — safe to re-run

-- Gantt fields on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6,2);

-- AI task pickup fields on tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'manual';
-- 'manual' | 'code' | 'content' | 'research' | 'business'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_output TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_session_id TEXT;

-- Task dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks',
  -- 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- External integration fields on tasks (for GitHub/GitLab sync)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_source TEXT;
-- 'github' | 'gitlab'
