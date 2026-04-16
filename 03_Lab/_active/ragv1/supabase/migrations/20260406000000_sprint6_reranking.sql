-- Sprint 6: add re-ranking feature flag and top-K setting
ALTER TABLE poc_ragv1.project_rag_settings
  ADD COLUMN IF NOT EXISTS enable_reranking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reranking_top_k integer NOT NULL DEFAULT 5;
