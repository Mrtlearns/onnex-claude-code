ALTER TABLE poc_ragv1.project_rag_settings
  ADD COLUMN IF NOT EXISTS custom_metadata_schema jsonb;
