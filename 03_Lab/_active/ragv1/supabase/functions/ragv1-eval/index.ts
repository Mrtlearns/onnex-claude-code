import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DB_SCHEMA = "poc_ragv1";
const GEMINI_MODEL = "gemini-2.5-flash";
const LLM_INPUT_COST_PER_M = 0.10;
const LLM_OUTPUT_COST_PER_M = 0.40;

interface EvalScore {
  score: number;
  reason: string;
}

async function callGeminiJson<T>(prompt: string, apiKey: string): Promise<{ result: T | null; inputTokens: number; outputTokens: number }> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!resp.ok) return { result: null, inputTokens: 0, outputTokens: 0 };
  const data = await resp.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  try {
    return { result: JSON.parse(raw) as T, inputTokens, outputTokens };
  } catch {
    return { result: null, inputTokens, outputTokens };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleApiKey = Deno.env.get("GOOGLE_API_KEY");

  if (!googleApiKey) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: DB_SCHEMA },
  });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Unauthorized");

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      // Allow service role
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role !== "service_role") throw new Error("Unauthorized");
      } catch {
        throw new Error("Unauthorized");
      }
    }

    const body = await req.json();
    const { retrieval_event_id } = body;
    if (!retrieval_event_id) throw new Error("retrieval_event_id required");

    // Fetch retrieval event and verify ownership
    const { data: event, error: eventError } = await supabaseAdmin
      .from("chat_retrieval_events")
      .select("*, chat_sessions!inner(project_id)")
      .eq("id", retrieval_event_id)
      .single();

    if (eventError || !event) throw new Error("Retrieval event not found");

    if (user) {
      // Verify project ownership
      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("owner_id")
        .eq("id", (event as any).chat_sessions?.project_id)
        .single();
      if ((proj as any)?.owner_id !== user.id) throw new Error("Access denied");
    }

    // Fetch user message
    const { data: userMsg } = await supabaseAdmin
      .from("chat_messages")
      .select("content")
      .eq("id", (event as any).user_message_id)
      .single();

    // Fetch assistant reply (most recent assistant message in session after user message)
    const { data: assistantMsg } = await supabaseAdmin
      .from("chat_messages")
      .select("content")
      .eq("chat_session_id", (event as any).chat_session_id)
      .eq("role", "assistant")
      .gt("id", (event as any).user_message_id)
      .order("id", { ascending: true })
      .limit(1)
      .single();

    // Fetch retrieved chunks
    const chunkIds: number[] = (event as any).selected_chunk_ids ?? [];
    let contextStr = "";
    if (chunkIds.length > 0) {
      const { data: chunks } = await supabaseAdmin
        .from("document_chunks")
        .select("content")
        .in("id", chunkIds);
      contextStr = (chunks ?? []).map((c: any) => c.content).join("\n\n---\n\n");
    }

    const query = userMsg?.content ?? "";
    const answer = assistantMsg?.content ?? "";
    const ctx = contextStr.slice(0, 6000); // Limit to avoid token overflow

    if (!query || !answer) {
      throw new Error("Missing query or answer for evaluation");
    }

    // Run 3 LLM-as-judge calls in parallel
    const [faithfulnessResult, relevanceResult, groundednessResult] = await Promise.all([
      callGeminiJson<EvalScore>(
        `You are an evaluation assistant.\n\nQuestion: ${query}\n\nContext chunks:\n${ctx}\n\nAI Answer:\n${answer}\n\nIs the answer grounded in the context? Score 0.000–1.000 (0=hallucinated, 1=fully grounded).\nReturn ONLY JSON: {"score": <float>, "reason": "<one sentence>"}`,
        googleApiKey
      ),
      callGeminiJson<EvalScore>(
        `You are an evaluation assistant.\n\nQuestion: ${query}\n\nContext chunks:\n${ctx}\n\nHow relevant are the context chunks to the question? Score 0.000–1.000 (0=irrelevant, 1=perfectly relevant).\nReturn ONLY JSON: {"score": <float>, "reason": "<one sentence>"}`,
        googleApiKey
      ),
      callGeminiJson<EvalScore>(
        `You are an evaluation assistant.\n\nAI Answer:\n${answer}\n\nContext chunks:\n${ctx}\n\nWhat fraction of the answer's sentences are directly supported by the context? Score 0.000–1.000.\nReturn ONLY JSON: {"score": <float>, "reason": "<one sentence>"}`,
        googleApiKey
      ),
    ]);

    // Calculate cost
    const totalInputTokens =
      faithfulnessResult.inputTokens + relevanceResult.inputTokens + groundednessResult.inputTokens;
    const totalOutputTokens =
      faithfulnessResult.outputTokens + relevanceResult.outputTokens + groundednessResult.outputTokens;
    const evalCostUsd =
      (totalInputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
      (totalOutputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;

    // Log cost
    try {
      await supabaseAdmin.from("usage_logs").insert({
        project_id: (event as any).chat_sessions?.project_id,
        operation: "eval_scoring",
        model_used: `google/${GEMINI_MODEL}`,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cost_usd: evalCostUsd,
      });
    } catch (e) {
      console.error("Failed to log eval cost (swallowed):", e);
    }

    // Insert eval results
    const { data: result, error: insertError } = await supabaseAdmin
      .from("eval_results")
      .insert({
        retrieval_event_id,
        faithfulness_score: faithfulnessResult.result?.score ?? null,
        faithfulness_reason: faithfulnessResult.result?.reason ?? null,
        relevance_score: relevanceResult.result?.score ?? null,
        relevance_reason: relevanceResult.result?.reason ?? null,
        groundedness_score: groundednessResult.result?.score ?? null,
        groundedness_reason: groundednessResult.result?.reason ?? null,
        eval_model_used: `google/${GEMINI_MODEL}`,
        eval_cost_usd: evalCostUsd,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ragv1-eval error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal server error" }),
      { status: e.message === "Unauthorized" || e.message === "Access denied" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
