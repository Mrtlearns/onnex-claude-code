-- Sprint 7: Fix vector search functions
-- Root cause: SET search_path TO '' broke pgvector <=> operator resolution
-- Fix: Set search_path to include 'public' where pgvector extension lives

-- Fix match_chunks: change search_path and remove explicit public.vector casts
CREATE OR REPLACE FUNCTION poc_ragv1.match_chunks(
  query_embedding vector,
  match_project_id bigint,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10
)
RETURNS TABLE(id bigint, document_id bigint, content text, chunk_index integer, page_number integer, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'poc_ragv1'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id, dc.document_id, dc.content, dc.chunk_index, dc.page_number, dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM poc_ragv1.document_chunks dc
  JOIN poc_ragv1.documents d ON d.id = dc.document_id
  WHERE d.project_id = match_project_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding))::float > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fix match_chunks_hybrid: change search_path and fix ambiguous column ref
CREATE OR REPLACE FUNCTION poc_ragv1.match_chunks_hybrid(
  query_text text,
  query_embedding vector,
  match_project_id bigint,
  match_count integer DEFAULT 10,
  rrf_k integer DEFAULT 60
)
RETURNS TABLE(id bigint, document_id bigint, content text, chunk_index integer, page_number integer, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'poc_ragv1'
AS $$
BEGIN
  RETURN QUERY
  WITH vector_ranked AS (
    SELECT
      dc.id AS chunk_id, dc.document_id, dc.content, dc.chunk_index, dc.page_number, dc.metadata,
      (1 - (dc.embedding <=> query_embedding))::float AS vec_sim,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding ASC) AS vec_rank
    FROM poc_ragv1.document_chunks dc
    JOIN poc_ragv1.documents d ON d.id = dc.document_id
    WHERE d.project_id = match_project_id AND dc.embedding IS NOT NULL
    LIMIT 100
  ),
  fts_ranked AS (
    SELECT
      dc.id AS chunk_id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.fts, plainto_tsquery('english', query_text)) DESC) AS fts_rank
    FROM poc_ragv1.document_chunks dc
    JOIN poc_ragv1.documents d ON d.id = dc.document_id
    WHERE d.project_id = match_project_id
      AND dc.fts @@ plainto_tsquery('english', query_text)
    LIMIT 100
  ),
  rrf_combined AS (
    SELECT
      vr.chunk_id, vr.document_id, vr.content, vr.chunk_index, vr.page_number, vr.metadata,
      vr.vec_sim AS sim,
      (1.0 / (rrf_k + vr.vec_rank)) + COALESCE(1.0 / (rrf_k + fr.fts_rank), 0.0) AS rrf_score
    FROM vector_ranked vr
    LEFT JOIN fts_ranked fr ON fr.chunk_id = vr.chunk_id
    UNION ALL
    SELECT
      dc.id AS chunk_id, dc.document_id, dc.content, dc.chunk_index, dc.page_number, dc.metadata,
      0.0::float AS sim,
      1.0 / (rrf_k + fr.fts_rank) AS rrf_score
    FROM fts_ranked fr
    JOIN poc_ragv1.document_chunks dc ON dc.id = fr.chunk_id
    LEFT JOIN vector_ranked vr ON vr.chunk_id = fr.chunk_id
    WHERE vr.chunk_id IS NULL
  )
  SELECT rc.chunk_id, rc.document_id, rc.content, rc.chunk_index, rc.page_number, rc.metadata, rc.sim
  FROM rrf_combined rc
  ORDER BY rc.rrf_score DESC
  LIMIT match_count;
END;
$$;
