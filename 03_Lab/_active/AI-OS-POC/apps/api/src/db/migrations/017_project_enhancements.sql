-- 017_project_enhancements.sql
-- Project detail upgrade: description, health indicator, color avatar,
-- project notes table, project members table

-- Add new columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS health TEXT CHECK (health IN ('on_track','at_risk','blocked')),
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'slate';

-- Project notes
CREATE TABLE IF NOT EXISTS project_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  author_id   TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_notes_project_idx ON project_notes (project_id, created_at DESC);

-- Project members (team tab)
CREATE TABLE IF NOT EXISTS project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'member',
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members (project_id);
