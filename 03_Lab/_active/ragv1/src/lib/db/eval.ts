import { supabase } from "@/integrations/supabase/client";

export interface EvalScore {
  faithfulness_score: number | null;
  relevance_score: number | null;
  groundedness_score: number | null;
  faithfulness_reason: string | null;
  relevance_reason: string | null;
  groundedness_reason: string | null;
  eval_cost_usd: number;
  created_at: string;
}

export interface EvalResultRow extends EvalScore {
  id: number;
  retrieval_event_id: number;
  retrieval_mode?: string;
  eval_model_used: string | null;
}

export async function getEvalResults(projectId: number): Promise<EvalResultRow[]> {
  // Two-step query to avoid complex nested PostgREST filtering.
  // Step 1: get retrieval event IDs for this project via sessions.
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("project_id", projectId);
  const sessionIds = (sessions ?? []).map((s: any) => s.id);
  if (sessionIds.length === 0) return [];

  const { data: events } = await supabase
    .from("chat_retrieval_events")
    .select("id, retrieval_mode")
    .in("chat_session_id", sessionIds);
  const eventIds = (events ?? []).map((e: any) => e.id);
  if (eventIds.length === 0) return [];

  const modeMap = new Map<number, string>((events ?? []).map((e: any) => [e.id, e.retrieval_mode]));

  // Step 2: get eval results for those events.
  const { data, error } = await supabase
    .from("eval_results")
    .select("*")
    .in("retrieval_event_id", eventIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    retrieval_mode: modeMap.get(row.retrieval_event_id),
  }));
}

export async function triggerEvalScoring(
  retrievalEventId: number,
  accessToken: string
): Promise<EvalScore> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  // Eval logic is merged into ragv1-chat/eval due to edge-runtime user-worker
  // routing constraints on the self-hosted Supabase instance.
  const resp = await fetch(`${supabaseUrl}/functions/v1/ragv1-eval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ retrieval_event_id: retrievalEventId }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Eval scoring failed (${resp.status}): ${text}`);
  }
  return resp.json();
}
