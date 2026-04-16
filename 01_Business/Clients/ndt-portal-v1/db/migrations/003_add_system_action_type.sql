-- Migration 003: Add 'system' action_type for pseudo-inspection-type steps
-- These are internal pipeline logic steps with no external service URL.
-- They appear in Settings for visibility but WF-5 treats them as informational.

ALTER TABLE app.inspection_steps
  DROP CONSTRAINT inspection_steps_action_type_check;

ALTER TABLE app.inspection_steps
  ADD CONSTRAINT inspection_steps_action_type_check
  CHECK (action_type IN ('llm', 'python', 'n8n', 'webhook', 'system'));
