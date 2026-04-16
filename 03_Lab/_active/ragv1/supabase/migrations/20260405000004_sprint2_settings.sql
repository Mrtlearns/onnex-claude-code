ALTER TABLE poc_ragv1.project_rag_settings
  ADD COLUMN IF NOT EXISTS enable_chunk_context boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_deep_extract boolean NOT NULL DEFAULT false;
