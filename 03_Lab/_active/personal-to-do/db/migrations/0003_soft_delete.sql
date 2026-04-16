-- Migration: Add soft-delete support to node_attachments
-- Deleted items are retained for 7 days, then permanently purged by the cleanup cron job.

ALTER TABLE poc_personal_to_do.node_attachments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_node_attachments_deleted_at
  ON poc_personal_to_do.node_attachments (deleted_at)
  WHERE deleted_at IS NOT NULL;
