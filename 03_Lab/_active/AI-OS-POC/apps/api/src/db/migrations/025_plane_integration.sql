-- Migration 025: Plane integration fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS plane_api_token TEXT;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS plane_project_id    TEXT;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS plane_workspace_slug TEXT;
