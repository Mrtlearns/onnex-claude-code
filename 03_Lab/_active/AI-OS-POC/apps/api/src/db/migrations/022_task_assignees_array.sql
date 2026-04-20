-- Migration 022: add assignee_ids uuid[] array to tasks
-- Supports multi-assignee while keeping legacy assignee_id for backwards compat
-- assignee_id is text (Authentik hex IDs), so assignee_ids must also be text[]
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids text[] NOT NULL DEFAULT '{}';
UPDATE tasks SET assignee_ids = ARRAY[assignee_id] WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR array_length(assignee_ids, 1) IS NULL);
