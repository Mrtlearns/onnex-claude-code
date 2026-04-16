import { supabase } from "@/integrations/supabase/client";

export async function getChatSessions(projectId: number) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createChatSession(projectId: number, title = "New Chat") {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ project_id: projectId, title })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChatSession(id: number) {
  const { error } = await supabase.from("chat_sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function getChatMessages(sessionId: number) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendChatMessage(sessionId: number, role: "user" | "assistant" | "system", content: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ chat_session_id: sessionId, role, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}
