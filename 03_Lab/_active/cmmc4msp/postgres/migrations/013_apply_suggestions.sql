-- Migration 013: track which suggestions have been applied to a control
ALTER TABLE artifact_control_suggestions
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acs_applied ON artifact_control_suggestions (control_definition_id) WHERE applied_at IS NOT NULL;
