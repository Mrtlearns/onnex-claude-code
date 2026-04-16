import { supabase } from "@/integrations/supabase/client";

export async function getEntities(projectId: number, type?: string) {
  let query = supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (type) query = query.eq("type", type as any);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getEntityRelations(projectId: number, limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from("entity_relations")
    .select("*, source:entities!entity_relations_source_entity_id_fkey(id,name,type), target:entities!entity_relations_target_entity_id_fkey(id,name,type)")
    .eq("project_id", projectId)
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function getEntityCount(projectId: number) {
  const { count, error } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) throw error;
  return count ?? 0;
}

export async function getEntityDistribution(projectId: number) {
  const { data, error } = await supabase
    .from("entities")
    .select("type")
    .eq("project_id", projectId);
  if (error) throw error;
  const dist: Record<string, number> = {};
  data?.forEach((e) => {
    dist[e.type] = (dist[e.type] || 0) + 1;
  });
  return Object.entries(dist).map(([type, count]) => ({ type, count }));
}
