import { supabase } from "@/integrations/supabase/client";

export async function getDocuments(projectId: number) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDocument(id: number) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createDocument(projectId: number, name: string, mimeType: string, sourcePath?: string) {
  const { data, error } = await supabase
    .from("documents")
    .insert({ project_id: projectId, name, mime_type: mimeType, source_path: sourcePath })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDocument(id: number, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("documents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(id: number) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function getDocumentChunks(documentId: number) {
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, page_number, content, status, metadata")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getChunkProcessingEvents(documentId: number) {
  const { data, error } = await supabase
    .from("chunk_processing_events")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadDocumentFile(projectId: number, file: File) {
  const path = `${projectId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("poc-ragv1-docs").upload(path, file);
  if (error) throw error;
  return path;
}
