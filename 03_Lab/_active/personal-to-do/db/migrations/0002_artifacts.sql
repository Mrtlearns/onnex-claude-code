-- Migration: Extend node_attachments to support artifact types (text, image, file)
-- Run: docker exec -i <db-container> psql -U supabase_admin -d postgres

ALTER TABLE poc_personal_to_do.node_attachments
  ADD COLUMN IF NOT EXISTS artifact_type TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS content TEXT,
  ALTER COLUMN filename DROP NOT NULL,
  ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE poc_personal_to_do.node_attachments
  DROP CONSTRAINT IF EXISTS check_artifact_type;

ALTER TABLE poc_personal_to_do.node_attachments
  ADD CONSTRAINT check_artifact_type
  CHECK (artifact_type IN ('text', 'image', 'file'));
