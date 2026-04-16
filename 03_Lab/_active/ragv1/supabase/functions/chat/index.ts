import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    // Verify session ownership
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("chat_sessions")
      .select("*, projects!inner(id, owner_id, default_system_prompt, conversation_memory_window)")
      .eq("id", session_id)
      .single();
    if (sessionError || !session) throw new Error("Session not found");
    if (!isServiceRole && (session as any).projects?.owner_id !== userId) throw new Error("Access denied");

    const project = (session as any).projects;
    const projectId = project.id;

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

    if (retrieval_mode === "hybrid") {
      // Hybrid: BM25 + vector + RRF via match_chunks_hybrid
      const queryEmbedding = googleApiKey
        ? await generateQueryEmbedding(message, googleApiKey)
        : null;

      if (queryEmbedding) {
        try {
          const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks_hybrid", {
            query_text: message,
            query_embedding: JSON.stringify(queryEmbedding),
            match_project_id: projectId,
            match_count: 10,
            rrf_k: 60,
          });
          contextChunks = matchedChunks || [];
        } catch (e) {
          console.error("match_chunks_hybrid failed, falling back to vector:", e);
          // Fallback to vector-only if hybrid RPC not available
          const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks", {
            query_embedding: JSON.stringify(queryEmbedding),
            match_project_id: projectId,
            match_threshold: 0.3,
            match_count: 10,
          });
          contextChunks = matchedChunks || [];
        }
      } else {
        console.warn("No GOOGLE_API_KEY — hybrid search skipped, returning empty context");
      }
    } else if (retrieval_mode === "mix" || retrieval_mode === "global") {
      // Vector similarity search
      const queryEmbedding = googleApiKey
        ? await generateQueryEmbedding(message, googleApiKey)
        : null;

      if (queryEmbedding) {
        const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_project_id: projectId,
          match_threshold: 0.3,
          match_count: retrieval_mode === "global" ? 15 : 8,
        });
        contextChunks = matchedChunks || [];
      } else {
        console.warn("No GOOGLE_API_KEY — vector search skipped");
      }
    }

    if (retrieval_mode === "mix" || retrieval_mode === "relation_only") {
      // Graph-based retrieval: find entities in the query and get related chunks
      const graphChunks = await getGraphContext(supabaseAdmin, projectId, message);
      const existingIds = new Set(contextChunks.map((c: any) => c.id));
      for (const gc of graphChunks) {
        if (!existingIds.has(gc.id)) contextChunks.push(gc);
      }
    }

    retrievalInfo.chunks_used = contextChunks.length;

    // Build context string
    const contextStr = contextChunks.length > 0
      ? contextChunks
          .map((c: any, i: number) => `[Source ${i + 1}] (chunk ${c.chunk_index}, similarity: ${(c.similarity || 0).toFixed(2)})\n${c.content}`)
          .join("\n\n---\n\n")
      : "No relevant context found in the knowledge base.";

    // Build messages for LLM
    const systemPrompt = `${project.default_system_prompt}

You have access to the following context from the knowledge base. Use it to answer the user's question accurately. Always cite your sources using [Source N] notation when using information from the context.

CONTEXT:
${contextStr}`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-project.conversation_memory_window * 2),
    ];

    // Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: llmMessages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);

          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullResponse += content;
            } catch { /* partial JSON */ }
          }
        }
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

          if (userMsg?.id) {
            await supabaseAdmin.from("chat_retrieval_events").insert({
              chat_session_id: session_id,
              user_message_id: userMsg.id,
              retrieval_mode,
              agentic_rounds: retrievalInfo.agentic_rounds,
              selected_chunk_ids: contextChunks.map((c: any) => c.id),
              total_cost_usd: 0,
              model_used: "google/gemini-3-flash-preview",
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
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Helper Functions ---

async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text.slice(0, 8192) }] },
        }),
      }
    );
    if (!response.ok) {
      const err = await response.text();
      console.error(`Google Embedding API ${response.status}: ${err}`);
      return null;
    }
    const data = await response.json();
    return data.embedding?.values ?? null;
  } catch (e) {
    console.error("Query embedding failed:", e);
    return null;
  }
}

async function getGraphContext(
  supabase: any,
  projectId: number,
  query: string
): Promise<any[]> {
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
