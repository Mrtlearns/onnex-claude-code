-- Sprint 1 fix: ivfflat max is 2000-dim; use 1536-dim (still 2x improvement over 768-dim fake)
-- Corrects the partial state left by 20260405000002_sprint1.sql

SET search_path = poc_ragv1, public;

-- ─── 1. Drop existing embedding index (was not dropped by previous migration) ──

DROP INDEX IF EXISTS poc_ragv1.idx_poc_ragv1_chunks_embedding;

-- ─── 2. Null existing embeddings then alter column to 1536-dim ─────────────────

UPDATE poc_ragv1.document_chunks SET embedding = NULL;

ALTER TABLE poc_ragv1.document_chunks
  ALTER COLUMN embedding TYPE public.vector(1536);

-- ─── 3. Rebuild IVFFlat index (1536 < 2000 dim limit) ─────────────────────────

CREATE INDEX idx_poc_ragv1_chunks_embedding
  ON poc_ragv1.document_chunks
  USING ivfflat (embedding public.vector_cosine_ops)
  WITH (lists = 100);

-- ─── 4. Correct match_chunks for 1536-dim ─────────────────────────────────────

CREATE OR REPLACE FUNCTION poc_ragv1.match_chunks(
  query_embedding public.vector(1536),
  match_project_id bigint,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint, document_id bigint, content text,
  chunk_index int, page_number int, metadata jsonb, similarity float
)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id, dc.document_id, dc.content, dc.chunk_index, dc.page_number, dc.metadata,
    (1 - (dc.embedding::public.vector <=> query_embedding::public.vector))::float AS similarity
  FROM poc_ragv1.document_chunks dc
  JOIN poc_ragv1.documents d ON d.id = dc.document_id
  WHERE d.project_id = match_project_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding::public.vector <=> query_embedding::public.vector))::float > match_threshold
  ORDER BY dc.embedding::public.vector <=> query_embedding::public.vector
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION poc_ragv1.match_chunks_hybrid(
  query_text text,
  query_embedding public.vector(1536),
  match_project_id bigint,
  match_count int DEFAULT 10,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id bigint, document_id bigint, content text,
  chunk_index int, page_number int, metadata jsonb, similarity float
)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH vector_ranked AS (
    SELECT
      dc.id, dc.document_id, dc.content, dc.chunk_index, dc.page_number, dc.metadata,
      (1 - (dc.embedding::public.vector <=> query_embedding::public.vector))::float AS vec_sim,
      ROW_NUMBER() OVER (ORDER BY dc.embedding::public.vector <=> query_embedding::public.vector ASC) AS vec_rank
    FROM poc_ragv1.document_chunks dc
    JOIN poc_ragv1.documents d ON d.id = dc.document_id
    WHERE d.project_id = match_project_id AND dc.embedding IS NOT NULL
    LIMIT 100
  ),
  fts_ranked AS (
    SELECT
      dc.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.fts, plainto_tsquery('english', query_text)) DESC) AS fts_rank
    FROM poc_ragv1.document_chunks dc
    JOIN poc_ragv1.documents d ON d.id = dc.document_id
    WHERE d.project_id = match_project_id
      AND dc.fts @@ plainto_tsquery('english', query_text)
    LIMIT 100
  ),
  rrf_combined AS (
    SELECT
      vr.id, vr.document_id, vr.content, vr.chunk_index, vr.page_number, vr.metadata,
      vr.vec_sim AS similarity,
      (1.0 / (rrf_k + vr.vec_rank)) + COALESCE(1.0 / (rrf_k + fr.fts_rank), 0.0) AS rrf_score
    FROM vector_ranked vr
    LEFT JOIN fts_ranked fr ON fr.id = vr.id
    UNION ALL
    SELECT
      dc.id, dc.document_id, dc.content, dc.chunk_index, dc.page_number, dc.metadata,
      0.0::float AS similarity,
      1.0 / (rrf_k + fr.fts_rank) AS rrf_score
    FROM fts_ranked fr
    JOIN poc_ragv1.document_chunks dc ON dc.id = fr.id
    LEFT JOIN vector_ranked vr ON vr.id = fr.id
    WHERE vr.id IS NULL
  )
  SELECT id, document_id, content, chunk_index, page_number, metadata, similarity
  FROM rrf_combined
  ORDER BY rrf_score DESC
  LIMIT match_count;
END;
$$;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA poc_ragv1 TO anon, authenticated, service_role;
