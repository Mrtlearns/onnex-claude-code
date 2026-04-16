import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DB_SCHEMA = "poc_ragv1";
const GEMINI_MODEL = "gemini-2.5-flash";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSIONALITY = 1536; // IVFFlat max is 2000-dim; 1536 is optimal balance

// Cost constants (USD per 1M tokens)
const EMBED_COST_PER_M = 0.15;
const LLM_INPUT_COST_PER_M = 0.10;
const LLM_OUTPUT_COST_PER_M = 0.40;

// ---------------------------------------------------------------------------
// Helper: callGeminiJson<T>
// Non-streaming Gemini call with structured JSON response mode.
// ---------------------------------------------------------------------------
async function callGeminiJson<T>(
  prompt: string,
  apiKey: string,
  model: string
): Promise<{ result: T | null; inputTokens: number; outputTokens: number }> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

// ---------------------------------------------------------------------------
// Helper: rerankChunks
// Post-retrieval LLM relevance scoring. Returns topK chunks sorted by score.
// Each chunk scored independently to avoid anchoring bias.
// ---------------------------------------------------------------------------
async function rerankChunks(
  chunks: any[],
  query: string,
  topK: number,
  apiKey: string,
  supabaseAdmin: any,
  projectId: number
): Promise<any[]> {
  if (chunks.length === 0) return [];
  let totalIn = 0, totalOut = 0;
  const scored = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const prompt =
          `Query: ${query}\n\nScore the relevance of this passage to the query (0.00–1.00).\n` +
          `Return ONLY JSON: {"score": <float>}\n\nPassage:\n${chunk.content.slice(0, 1500)}`;
        const r = await callGeminiJson<{ score: number }>(prompt, apiKey, GEMINI_MODEL);
        totalIn += r.inputTokens;
        totalOut += r.outputTokens;
        return { ...chunk, rerankScore: r.result?.score ?? chunk.similarity ?? 0 };
      } catch {
        return { ...chunk, rerankScore: chunk.similarity ?? 0 };
      }
    })
  );
  const costUsd =
    (totalIn / 1_000_000) * LLM_INPUT_COST_PER_M +
    (totalOut / 1_000_000) * LLM_OUTPUT_COST_PER_M;
  await logCost(supabaseAdmin, projectId, "reranking", `google/${GEMINI_MODEL}`, totalIn, totalOut, costUsd);
  return scored.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topK);
}

// ---------------------------------------------------------------------------
// Helper: runReActLoop
// True ReAct-style agentic retrieval: retrieve → evaluate sufficiency →
// reformulate query → repeat. Replaces the old shallow query decomposition.
// ---------------------------------------------------------------------------
interface SufficiencyCheck {
  is_sufficient: boolean;
  missing_aspects: string | null;
  follow_up_query: string | null;
}

async function runReActLoop(
  supabaseAdmin: any,
  originalQuery: string,
  retrieval_mode: string,
  projectId: number,
  googleApiKey: string,
  maxRounds: number
): Promise<{ chunks: any[]; actualRounds: number }> {
  const chunkMap = new Map<number, any>();
  const queryHistory: string[] = [];
  let currentQuery = originalQuery;
  let actualRounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    actualRounds = round + 1;

    // Guard: stop if query repeats (Gemini is stuck)
    if (queryHistory.includes(currentQuery)) {
      console.log(`ReAct: query repeated at round ${round}, stopping.`);
      break;
    }
    queryHistory.push(currentQuery);

    const newChunks = await retrieveChunks(supabaseAdmin, currentQuery, retrieval_mode, projectId, googleApiKey);
    let addedCount = 0;
    for (const c of newChunks) {
      if (!chunkMap.has(c.id)) {
        chunkMap.set(c.id, c);
        addedCount++;
      }
    }

    // Guard: nothing new found after first round → no benefit in continuing
    if (addedCount === 0 && round > 0) {
      console.log(`ReAct: no new chunks at round ${round}, stopping.`);
      break;
    }

    // Last round: skip sufficiency check, go to generation
    if (round === maxRounds - 1) break;

    const previews = Array.from(chunkMap.values())
      .map((c, i) => `[${i + 1}] ${c.content.slice(0, 200)}`)
      .join("\n");

    const prompt =
      `User question: ${originalQuery}\n\nRetrieved context previews:\n${previews}\n\n` +
      `Answer in JSON only (no other text):\n` +
      `{"is_sufficient": true|false, "missing_aspects": "description or null", "follow_up_query": "targeted query or null"}\n\n` +
      `Rules:\n` +
      `- is_sufficient=true if context fully answers the question.\n` +
      `- is_sufficient=true if the answer is simply not in the documents (prevents infinite loops).\n` +
      `- follow_up_query must be specific and different from previous queries.`;

    const check = await callGeminiJson<SufficiencyCheck>(prompt, googleApiKey, GEMINI_MODEL);
    if (check.result) {
      const costUsd =
        (check.inputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
        (check.outputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;
      await logCost(supabaseAdmin, projectId, "agentic_sufficiency_check",
        `google/${GEMINI_MODEL}`, check.inputTokens, check.outputTokens, costUsd);
    }

    if (!check.result?.is_sufficient && check.result?.follow_up_query) {
      currentQuery = check.result.follow_up_query;
    } else {
      break;
    }
  }

  return { chunks: Array.from(chunkMap.values()), actualRounds };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!googleApiKey) throw new Error("GOOGLE_API_KEY is not configured");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: DB_SCHEMA },
    });

    // Verify user from token
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    let isServiceRole = false;

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role === "service_role") {
          isServiceRole = true;
          userId = "__service_role__";
        } else {
          throw new Error("Unauthorized");
        }
      } catch {
        throw new Error("Unauthorized");
      }
    } else {
      userId = user.id;
    }

    const { session_id, message, retrieval_mode = "mix" } = await req.json();
    if (!session_id || !message) throw new Error("session_id and message are required");

    // Bug 6 fix: removed agentic_enabled/agentic_max_rounds from projects join —
    // those columns are on project_rag_settings, not projects.
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("chat_sessions")
      .select(
        "*, projects!inner(id, owner_id, default_system_prompt, conversation_memory_window, spending_cap_usd, current_spend_usd)"
      )
      .eq("id", session_id)
      .single();
    if (sessionError || !session) throw new Error("Session not found");
    if (!isServiceRole && (session as any).projects?.owner_id !== userId) throw new Error("Access denied");

    const project = (session as any).projects;
    const projectId = project.id;

    // Bug 6 fix: fetch agentic + reranking settings from the correct table
    const { data: ragSettings } = await supabaseAdmin
      .from("project_rag_settings")
      .select("agentic_enabled, agentic_max_rounds, enable_reranking, reranking_top_k")
      .eq("project_id", projectId)
      .single();

    // Save user message
    const { data: userMsg } = await supabaseAdmin
      .from("chat_messages")
      .insert({ chat_session_id: session_id, role: "user", content: message })
      .select("id")
      .single();

    // Get conversation history
    const { data: history } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("chat_session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(project.conversation_memory_window * 2);

    // --- Retrieval ---
    let contextChunks: any[] = [];
    const retrievalInfo = { mode: retrieval_mode, chunks_used: 0, agentic_rounds: 0 };

    if (ragSettings?.agentic_enabled) {
      // ReAct agentic loop: iterative retrieve → evaluate → reformulate
      const { chunks, actualRounds } = await runReActLoop(
        supabaseAdmin, message, retrieval_mode, projectId, googleApiKey,
        ragSettings.agentic_max_rounds ?? 3
      );
      contextChunks = chunks;
      retrievalInfo.agentic_rounds = actualRounds;
    } else {
      // Standard single-pass retrieval
      contextChunks = await retrieveChunks(supabaseAdmin, message, retrieval_mode, projectId, googleApiKey);
    }

    // Re-ranking: post-retrieval LLM relevance scoring (gated by feature flag)
    if (ragSettings?.enable_reranking && contextChunks.length > 0) {
      contextChunks = await rerankChunks(
        contextChunks, message, ragSettings.reranking_top_k ?? 5,
        googleApiKey, supabaseAdmin, projectId
      );
    }

    retrievalInfo.chunks_used = contextChunks.length;

    // Build context string (shows rerankScore when re-ranking was applied)
    const contextStr = contextChunks.length > 0
      ? contextChunks
          .map((c: any, i: number) => {
            const score = c.rerankScore ?? c.similarity ?? 0;
            return `[Source ${i + 1}] (chunk ${c.chunk_index}, score: ${score.toFixed(2)})\n${c.content}`;
          })
          .join("\n\n---\n\n")
      : "No relevant context found in the knowledge base.";

    const systemPrompt = `${project.default_system_prompt}

You have access to the following context from the knowledge base. Use it to answer the user's question accurately. Always cite your sources using [Source N] notation when using information from the context.

CONTEXT:
${contextStr}`;

    // Build Gemini contents array from history
    const historyMessages = (history || []).slice(-project.conversation_memory_window * 2);
    const contents = historyMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    // Ensure last message is from user (the current message)
    if (contents.length === 0 || contents[contents.length - 1]?.role !== "user") {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    // Call Gemini streaming API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${googleApiKey}`;
    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, errText);
      throw new Error(`Gemini API error: ${aiResponse.status}`);
    }

    // Transform Gemini SSE → OpenAI-style SSE (frontend parser expects choices[0].delta.content)
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let capturedUsageMetadata: any = null;

    (async () => {
      const encoder = new TextEncoder();
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ") || line.trim() === "data: ") continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const geminiChunk = JSON.parse(jsonStr);

              // Capture usageMetadata whenever present (last chunk typically has it)
              if (geminiChunk.usageMetadata) {
                capturedUsageMetadata = geminiChunk.usageMetadata;
              }

              const text = geminiChunk.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullResponse += text;
                // Emit as OpenAI-style SSE so Chat.tsx parser works unchanged
                const openAiChunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
                await writer.write(encoder.encode(`data: ${openAiChunk}\n\n`));
              }
            } catch { /* partial JSON — skip */ }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        await writer.close();

        try {
          await supabaseAdmin.from("chat_messages").insert({
            chat_session_id: session_id,
            role: "assistant",
            content: fullResponse,
          });

          // --- Log chat cost ---
          const inputTokens = capturedUsageMetadata?.promptTokenCount ?? Math.ceil(systemPrompt.length / 4);
          const outputTokens = capturedUsageMetadata?.candidatesTokenCount ?? Math.ceil(fullResponse.length / 4);
          const chatCostUsd =
            (inputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
            (outputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;

          await logCost(
            supabaseAdmin,
            projectId,
            "chat",
            GEMINI_MODEL,
            inputTokens,
            outputTokens,
            chatCostUsd
          );

          // Increment project spend
          if (chatCostUsd > 0) {
            try {
              await supabaseAdmin.rpc("increment_project_spend", {
                p_project_id: projectId,
                p_amount: chatCostUsd,
              });
            } catch {
              try {
                const { data: proj } = await supabaseAdmin
                  .from("projects")
                  .select("current_spend_usd")
                  .eq("id", projectId)
                  .single();
                const current = (proj as any)?.current_spend_usd ?? 0;
                await supabaseAdmin
                  .from("projects")
                  .update({ current_spend_usd: current + chatCostUsd })
                  .eq("id", projectId);
              } catch (e2) {
                console.error("Failed to update project spend:", e2);
              }
            }
          }

          if (userMsg?.id) {
            await supabaseAdmin.from("chat_retrieval_events").insert({
              chat_session_id: session_id,
              user_message_id: userMsg.id,
              retrieval_mode,
              agentic_rounds: retrievalInfo.agentic_rounds,
              selected_chunk_ids: contextChunks.map((c: any) => c.id),
              total_cost_usd: chatCostUsd,
              model_used: `google/${GEMINI_MODEL}`,
            });
          }

          if ((history || []).length <= 1) {
            const title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
            await supabaseAdmin.from("chat_sessions").update({ title, updated_at: new Date().toISOString() }).eq("id", session_id);
          }
        } catch (e) {
          console.error("Failed to save assistant message:", e);
        }
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ragv1-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

async function logCost(
  supabase: any,
  projectId: number,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
): Promise<void> {
  try {
    await supabase.from("usage_logs").insert({
      project_id: projectId,
      operation,
      model_used: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });
  } catch (e) {
    console.error("logCost failed (swallowed):", e);
  }
}

async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: text.slice(0, 8192) }] },
          output_dimensionality: EMBED_DIMENSIONALITY,
        }),
      }
    );
    if (!response.ok) {
      console.error(`Google Embedding API ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    return data.embedding?.values ?? null;
  } catch (e) {
    console.error("Query embedding failed:", e);
    return null;
  }
}

async function retrieveChunks(
  supabaseAdmin: any,
  query: string,
  retrieval_mode: string,
  projectId: number,
  googleApiKey: string
): Promise<any[]> {
  // Bug 4 fix: human_in_the_loop two-pass flow not yet implemented — degrade to mix.
  // TODO: implement chunk selection UI + second-pass generation in a future sprint.
  const effective_mode = retrieval_mode === "human_in_the_loop" ? "mix" : retrieval_mode;

  const chunks: any[] = [];

  if (effective_mode === "hybrid") {
    const queryEmbedding = await generateQueryEmbedding(query, googleApiKey);
    if (queryEmbedding) {
      try {
        const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks_hybrid", {
          query_text: query,
          query_embedding: JSON.stringify(queryEmbedding),
          match_project_id: projectId,
          match_count: 10,
          rrf_k: 60,
        });
        chunks.push(...(matchedChunks || []));
      } catch (e) {
        console.error("match_chunks_hybrid failed, falling back to vector:", e);
        const queryEmbedding2 = await generateQueryEmbedding(query, googleApiKey);
        if (queryEmbedding2) {
          const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks", {
            query_embedding: JSON.stringify(queryEmbedding2),
            match_project_id: projectId,
            match_threshold: 0.3,
            match_count: 10,
          });
          chunks.push(...(matchedChunks || []));
        }
      }
    }
  } else if (effective_mode === "mix" || effective_mode === "global") {
    const queryEmbedding = await generateQueryEmbedding(query, googleApiKey);
    if (queryEmbedding) {
      const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_project_id: projectId,
        match_threshold: 0.3,
        match_count: effective_mode === "global" ? 15 : 8,
      });
      chunks.push(...(matchedChunks || []));
    }
  }

  if (effective_mode === "mix" || effective_mode === "relation_only") {
    const graphChunks = await getGraphContext(supabaseAdmin, projectId, query);
    const existingIds = new Set(chunks.map((c: any) => c.id));
    for (const gc of graphChunks) {
      if (!existingIds.has(gc.id)) chunks.push(gc);
    }
  }

  return chunks;
}

async function getGraphContext(supabase: any, projectId: number, query: string): Promise<any[]> {
  const { data: entities } = await supabase
    .from("entities")
    .select("id, name, type")
    .eq("project_id", projectId);

  if (!entities || entities.length === 0) return [];

  const queryLower = query.toLowerCase();
  const matchedEntityIds = entities
    .filter((e: any) => queryLower.includes(e.name.toLowerCase()))
    .map((e: any) => e.id);

  if (matchedEntityIds.length === 0) return [];

  const { data: relations } = await supabase
    .from("entity_relations")
    .select("source_entity_id, target_entity_id, relation_type, metadata")
    .eq("project_id", projectId)
    .or(
      matchedEntityIds.map((id: number) => `source_entity_id.eq.${id}`).join(",") +
        "," +
        matchedEntityIds.map((id: number) => `target_entity_id.eq.${id}`).join(",")
    );

  if (!relations || relations.length === 0) return [];

  const docIds = new Set<number>();
  for (const r of relations) {
    if (r.metadata?.source_document_id) docIds.add(r.metadata.source_document_id);
  }
  if (docIds.size === 0) return [];

  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("id, document_id, content, chunk_index, page_number, metadata")
    .in("document_id", Array.from(docIds))
    .limit(10);

  return (chunks || []).map((c: any) => ({ ...c, similarity: 0 }));
}
