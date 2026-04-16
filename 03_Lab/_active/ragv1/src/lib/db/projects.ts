import { supabase } from "@/integrations/supabase/client";

export async function getProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProject(id: number) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject(name: string, description?: string) {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: number, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: number) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
