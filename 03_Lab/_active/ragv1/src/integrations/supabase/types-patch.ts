// Manual type patch for columns/enums added after last supabase gen types run,
// or from the poc_ragv1 schema which differs from the public schema captured in types.ts.
//
// Long-term fix: run `supabase gen types typescript --schema poc_ragv1` to regenerate.

export type RetrievalMode =
  | "mix"
  | "relation_only"
  | "global"
  | "human_in_the_loop"
  | "hybrid";

// Columns added to project_rag_settings in sprints 2–6 (not yet in auto-gen types)
export interface RagSettingsExtra {
  enable_deep_extract: boolean;
  enable_chunk_context: boolean;
  custom_metadata_schema: Record<string, unknown> | null;
  processing_mode: string;
  enable_reranking: boolean;
  reranking_top_k: number;
}
