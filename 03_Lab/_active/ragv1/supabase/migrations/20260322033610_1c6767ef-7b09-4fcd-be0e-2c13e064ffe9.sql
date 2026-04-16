
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding extensions.vector(768),
  match_project_id bigint,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
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
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.page_number,
    dc.metadata,
    (1 - (dc.embedding::extensions.vector <=> query_embedding::extensions.vector))::float AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE d.project_id = match_project_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding::extensions.vector <=> query_embedding::extensions.vector))::float > match_threshold
  ORDER BY dc.embedding::extensions.vector <=> query_embedding::extensions.vector
  LIMIT match_count;
END;
$$;
