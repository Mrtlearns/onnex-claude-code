-- Sprint 4: Add processing_mode column to project_rag_settings
ALTER TABLE poc_ragv1.project_rag_settings
  ADD COLUMN IF NOT EXISTS processing_mode text NOT NULL DEFAULT 'custom';
