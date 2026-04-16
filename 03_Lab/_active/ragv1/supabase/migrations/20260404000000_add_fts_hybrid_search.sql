-- Migration: Add full-text search and hybrid search function
-- Date: 2026-04-04

-- Add FTS column to document_chunks (auto-populated from content via GENERATED ALWAYS)
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts
  ON public.document_chunks USING gin(fts);

-- Hybrid search: BM25 (full-text) + vector similarity, combined with Reciprocal Rank Fusion (RRF)
-- RRF score = 1/(k + vector_rank) + 1/(k + fts_rank), k=60 by default
CREATE OR REPLACE FUNCTION public.match_chunks_hybrid(
  query_text text,
  query_embedding extensions.vector(768),
  match_project_id bigint,
  match_count int DEFAULT 10,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id bigint,
  document_id bigint,
  content text,
  chunk_index int,
  page_number int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH vector_ranked AS (
    -- Top 100 chunks by vector cosine similarity
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.chunk_index,
      dc.page_number,
      dc.metadata,
      (1 - (dc.embedding::extensions.vector <=> query_embedding::extensions.vector))::float AS vec_sim,
      ROW_NUMBER() OVER (
        ORDER BY dc.embedding::extensions.vector <=> query_embedding::extensions.vector ASC
      ) AS vec_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE d.project_id = match_project_id
      AND dc.embedding IS NOT NULL
    LIMIT 100
  ),
  fts_ranked AS (
    -- Top 100 chunks by BM25 full-text rank (plainto_tsquery handles arbitrary input safely)
    SELECT
      dc.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(dc.fts, plainto_tsquery('english', query_text)) DESC
      ) AS fts_rank
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE d.project_id = match_project_id
      AND dc.fts @@ plainto_tsquery('english', query_text)
    LIMIT 100
  ),
  rrf_combined AS (
    -- Vector results joined with optional FTS scores
    SELECT
      vr.id,
      vr.document_id,
      vr.content,
      vr.chunk_index,
      vr.page_number,
      vr.metadata,
      vr.vec_sim AS similarity,
      (1.0 / (rrf_k + vr.vec_rank)) + COALESCE(1.0 / (rrf_k + fr.fts_rank), 0.0) AS rrf_score
    FROM vector_ranked vr
    LEFT JOIN fts_ranked fr ON fr.id = vr.id

    UNION ALL

    -- FTS-only results not captured in vector results
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.chunk_index,
      dc.page_number,
      dc.metadata,
      0.0::float AS similarity,
      1.0 / (rrf_k + fr.fts_rank) AS rrf_score
    FROM fts_ranked fr
    JOIN public.document_chunks dc ON dc.id = fr.id
    LEFT JOIN vector_ranked vr ON vr.id = fr.id
    WHERE vr.id IS NULL
  )
  SELECT
    id,
    document_id,
    content,
    chunk_index,
    page_number,
    metadata,
    similarity
  FROM rrf_combined
  ORDER BY rrf_score DESC
  LIMIT match_count;
END;
$$;
