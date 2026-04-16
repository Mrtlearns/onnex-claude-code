import { supabase } from "@/integrations/supabase/client";

export async function getRagSettings(projectId: number) {
  const { data, error } = await supabase
    .from("project_rag_settings")
    .select("*")
    .eq("project_id", projectId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRagSettings(projectId: number, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("project_rag_settings")
    .update(updates)
    .eq("project_id", projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getApiKeys(projectId: number) {
  const { data, error } = await supabase
    .from("project_api_keys")
    .select("*")
    .eq("project_id", projectId)
    .order("is_default", { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertApiKey(projectId: number, provider: string, apiKey: string, modelName: string, isDefault = false) {
  const { data, error } = await supabase
    .from("project_api_keys")
    .insert({ project_id: projectId, provider: provider as any, api_key: apiKey, model_name: modelName, is_default: isDefault })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteApiKey(id: number) {
  const { error } = await supabase.from("project_api_keys").delete().eq("id", id);
  if (error) throw error;
}
