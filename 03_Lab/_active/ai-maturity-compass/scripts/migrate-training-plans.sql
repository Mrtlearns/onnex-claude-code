-- Migration: Add training plan columns to respondent_results
-- Run this after the initial schema.sql if the table already exists

ALTER TABLE respondent_results
  ADD COLUMN IF NOT EXISTS training_plan_json  JSONB,
  ADD COLUMN IF NOT EXISTS training_plan_markdown TEXT,
  ADD COLUMN IF NOT EXISTS competency_level   INTEGER CHECK (competency_level BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS competency_label   TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'respondent_results'
  AND column_name IN ('training_plan_json', 'training_plan_markdown', 'competency_level', 'competency_label')
ORDER BY column_name;
