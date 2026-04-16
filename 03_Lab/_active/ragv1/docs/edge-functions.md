# Edge Functions — Full Source Code Reference

This document contains the complete source code for both Supabase Edge Functions, with inline commentary. Use this to reconstruct them as Node.js/Express endpoints or any other runtime.

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (or your API URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin DB access |
| `LOVABLE_API_KEY` | Lovable AI Gateway key for LLM calls |

---

## Converting to Node.js/Express

Key changes needed:
- Replace `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` with Express/Fastify router
- Replace `Deno.env.get("VAR")` with `process.env.VAR`
- Replace `import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"` with `import { createClient } from "@supabase/supabase-js"`
- The `serve()` handler maps to a single POST route handler
- All `fetch()` calls, `Response`, `Request` objects work identically in Node 18+

Example Express wrapper:
```typescript
import express from "express";
const app = express();
app.use(express.json());

app.post("/process-document", async (req, res) => {
  // Copy the handler logic from serve() callback
  // req.headers.get("Authorization") → req.headers.authorization
  // Return: res.json({ ... }) instead of new Response(JSON.stringify(...))
});
```

---

## 1. `process-document/index.ts`

**Purpose**: Process an uploaded document — chunk text, generate embeddings, extract entities and relations.

**Input**: `POST { document_id: number }`  
**Auth**: Bearer token (user JWT or service_role)  
**Output**: `{ success: true, chunks_created: number, document_id: number }`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHUNK_SIZE = 1000; // tokens approx (chars / 4)
const CHUNK_OVERLAP = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // --- AUTH: Verify user from token ---
    // Supports both regular user JWTs and service_role JWTs
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

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id is required");

    // --- FETCH DOCUMENT & VERIFY OWNERSHIP ---
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*, projects!inner(owner_id)")
      .eq("id", document_id)
      .single();
    if (docError || !doc) throw new Error("Document not found");
    if (!isServiceRole && (doc as any).projects?.owner_id !== userId) throw new Error("Access denied");

    // Update status to processing
    await supabaseAdmin.from("documents").update({ status: "processing" }).eq("id", document_id);

    // --- DOWNLOAD FILE FROM STORAGE ---
    // ⚠️ Only works for plain text files. PDFs/DOCX need a parsing library.
    let textContent = "";
    if (doc.source_path) {
      const { data: fileData, error: dlError } = await supabaseAdmin.storage
        .from("documents")
        .download(doc.source_path);
      if (dlError) throw new Error(`Failed to download file: ${dlError.message}`);
      textContent = await fileData.text();
    }

    if (!textContent.trim()) {
      await supabaseAdmin.from("documents").update({ status: "error" }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "Empty document content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- CHUNKING ---
    // chunkSize and overlap are multiplied by 4 to convert from token count to char count
    const chunks = chunkText(textContent, CHUNK_SIZE * 4, CHUNK_OVERLAP * 4);
    console.log(`Document ${document_id}: created ${chunks.length} chunks`);

    // Insert chunks into DB
    const chunkRows = chunks.map((content, index) => ({
      document_id,
      content,
      chunk_index: index,
      metadata: {},
      status: "processed" as const,
    }));

    const { data: insertedChunks, error: chunkError } = await supabaseAdmin
      .from("document_chunks")
      .insert(chunkRows)
      .select("id, chunk_index");
    if (chunkError) throw new Error(`Failed to insert chunks: ${chunkError.message}`);

    // --- EMBEDDING GENERATION ---
    // Uses chat-based semantic fingerprinting (see generateEmbedding below)
    if (lovableApiKey) {
      for (const chunk of chunks) {
        const chunkRecord = insertedChunks?.find((c: any) => c.chunk_index === chunks.indexOf(chunk));
        if (!chunkRecord) continue;

        try {
          const embedding = await generateEmbedding(chunk, lovableApiKey);
          if (embedding) {
            await supabaseAdmin
              .from("document_chunks")
              .update({ embedding: JSON.stringify(embedding) })
              .eq("id", chunkRecord.id);
          }
        } catch (e) {
          console.error(`Embedding failed for chunk ${chunkRecord.id}:`, e);
          await supabaseAdmin.from("chunk_processing_events").insert({
            document_id,
            chunk_id: chunkRecord.id,
            status: "error",
            error_message: `Embedding generation failed: ${e instanceof Error ? e.message : "Unknown error"}`,
          });
        }
      }
    } else {
      console.warn("LOVABLE_API_KEY not set, skipping embedding generation");
    }

    // --- ENTITY EXTRACTION ---
    const projectSettings = await supabaseAdmin
      .from("project_rag_settings")
      .select("enable_entity_extraction, enable_relation_extraction")
      .eq("project_id", doc.project_id)
      .single();

    if (projectSettings.data?.enable_entity_extraction && lovableApiKey) {
      try {
        const entities = await extractEntities(textContent.slice(0, 8000), lovableApiKey);
        if (entities.length > 0) {
          const entityRows = entities.map((e: any) => ({
            project_id: doc.project_id,
            name: e.name,
            type: e.type,
            metadata: { source_document_id: document_id },
          }));
          await supabaseAdmin.from("entities").insert(entityRows);
          console.log(`Extracted ${entities.length} entities`);

          // --- RELATION EXTRACTION ---
          if (projectSettings.data?.enable_relation_extraction && entities.length >= 2) {
            const relations = await extractRelations(textContent.slice(0, 8000), entities, lovableApiKey);
            if (relations.length > 0) {
              const { data: dbEntities } = await supabaseAdmin
                .from("entities")
                .select("id, name")
                .eq("project_id", doc.project_id);
              const nameToId = new Map((dbEntities || []).map((e: any) => [e.name.toLowerCase(), e.id]));

              const relationRows = relations
                .map((r: any) => {
                  const sourceId = nameToId.get(r.source?.toLowerCase());
                  const targetId = nameToId.get(r.target?.toLowerCase());
                  if (!sourceId || !targetId) return null;
                  return {
                    project_id: doc.project_id,
                    source_entity_id: sourceId,
                    target_entity_id: targetId,
                    relation_type: r.relation_type || "related_to",
                    metadata: { source_document_id: document_id },
                  };
                })
                .filter(Boolean);

              if (relationRows.length > 0) {
                await supabaseAdmin.from("entity_relations").insert(relationRows);
                console.log(`Extracted ${relationRows.length} relations`);
              }
            }
          }
        }
      } catch (e) {
        console.error("Entity extraction failed:", e);
      }
    }

    // --- FINALIZE ---
    await supabaseAdmin
      .from("documents")
      .update({ status: "processed", updated_at: new Date().toISOString() })
      .eq("id", document_id);

    await supabaseAdmin.from("chunk_processing_events").insert({
      document_id,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: chunks.length,
        document_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================================================
// HELPER: chunkText
// =============================================================================
// Splits text into overlapping chunks, trying to break at sentence boundaries.

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }

    chunks.push(chunk.trim());
    start += chunk.length - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 0);
}

// =============================================================================
// HELPER: generateEmbedding (Chat-Based Semantic Fingerprinting)
// =============================================================================
// Step 1: Ask LLM to extract 30 concept-weight pairs from the text
// Step 2: Hash concepts into a deterministic 768-dim vector
// Fallback: Use textToHashVector if LLM call fails

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "Extract a semantic fingerprint from the text. Return exactly 30 key concepts/topics with relevance weights (0.0-1.0). Be consistent: similar texts should produce similar concepts. Focus on concrete nouns, verbs, and domain terms.",
        },
        { role: "user", content: text.slice(0, 3000) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_fingerprint",
            description: "Return semantic fingerprint as concept-weight pairs",
            parameters: {
              type: "object",
              properties: {
                concepts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      concept: { type: "string", description: "A key concept, topic, or theme (lowercase, 1-3 words)" },
                      weight: { type: "number", description: "Relevance weight from 0.0 to 1.0" },
                    },
                    required: ["concept", "weight"],
                    additionalProperties: false,
                  },
                  description: "Exactly 30 concept-weight pairs",
                },
              },
              required: ["concepts"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_fingerprint" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    if (Array.isArray(parsed.concepts) && parsed.concepts.length > 0) {
      return conceptsToVector(parsed.concepts);
    }
  }
  console.warn("Failed to parse fingerprint response, falling back to text hash");
  return textToHashVector(text);
}

// =============================================================================
// HELPER: conceptsToVector
// =============================================================================
// Deterministically converts concept-weight pairs into a 768-dim unit vector.
// Each concept's characters and bigrams are hashed to multiple vector positions
// with signed contributions weighted by the concept's relevance weight.

function conceptsToVector(concepts: Array<{ concept: string; weight: number }>): number[] {
  const vec = new Float64Array(768);

  for (const { concept, weight } of concepts) {
    const w = Math.max(0, Math.min(1, weight));
    // Hash each character to 8 positions using multiple hash functions
    for (let i = 0; i < concept.length; i++) {
      const code = concept.charCodeAt(i);
      for (let h = 0; h < 8; h++) {
        const idx = ((code * 31 + i * 97 + h * 53) & 0x7FFFFFFF) % 768;
        const sign = ((code * 17 + h * 41 + i) % 2 === 0) ? 1 : -1;
        vec[idx] += sign * w * (1 / (1 + i * 0.1));
      }
    }
    // Bigram hashing for better semantic resolution
    for (let i = 0; i < concept.length - 1; i++) {
      const bigram = concept.charCodeAt(i) * 256 + concept.charCodeAt(i + 1);
      const idx = (bigram * 37) % 768;
      const sign = (bigram % 2 === 0) ? 1 : -1;
      vec[idx] += sign * w * 0.5;
    }
  }

  // L2 normalize for cosine similarity compatibility
  let norm = 0;
  for (let i = 0; i < 768; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 768; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

// =============================================================================
// HELPER: textToHashVector (Fallback)
// =============================================================================
// Deterministic trigram hash vector. Used when the LLM call fails.

function textToHashVector(text: string): number[] {
  const vec = new Float64Array(768);
  const lower = text.toLowerCase();

  for (let i = 0; i < lower.length - 2; i++) {
    const trigram = lower.charCodeAt(i) * 65536 + lower.charCodeAt(i + 1) * 256 + lower.charCodeAt(i + 2);
    const idx = (trigram * 31) % 768;
    const sign = (trigram % 2 === 0) ? 1 : -1;
    vec[idx] += sign;
  }

  let norm = 0;
  for (let i = 0; i < 768; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 768; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

// =============================================================================
// HELPER: extractEntities
// =============================================================================
// Uses Gemini structured output to extract named entities from text.

async function extractEntities(
  text: string,
  apiKey: string
): Promise<Array<{ name: string; type: string }>> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Extract named entities from the text. Types: organization, person, product, date, concept, event, technology, location, other.",
        },
        { role: "user", content: text },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_entities",
            description: "Extract named entities from text",
            parameters: {
              type: "object",
              properties: {
                entities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: {
                        type: "string",
                        enum: [
                          "organization", "person", "product", "date",
                          "concept", "event", "technology", "location", "other",
                        ],
                      },
                    },
                    required: ["name", "type"],
                  },
                },
              },
              required: ["entities"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_entities" } },
    }),
  });

  if (!response.ok) {
    await response.text();
    return [];
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.entities || [];
  }
  return [];
}

// =============================================================================
// HELPER: extractRelations
// =============================================================================
// Uses Gemini structured output to extract relationships between known entities.

async function extractRelations(
  text: string,
  entities: Array<{ name: string; type: string }>,
  apiKey: string
): Promise<Array<{ source: string; target: string; relation_type: string }>> {
  const entityList = entities.map((e) => `${e.name} (${e.type})`).join(", ");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Extract relationships between these entities: ${entityList}. Use the entity names exactly as given.`,
        },
        { role: "user", content: text },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_relations",
            description: "Extract relationships between entities",
            parameters: {
              type: "object",
              properties: {
                relations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      target: { type: "string" },
                      relation_type: { type: "string" },
                    },
                    required: ["source", "target", "relation_type"],
                  },
                },
              },
              required: ["relations"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_relations" } },
    }),
  });

  if (!response.ok) {
    await response.text();
    return [];
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.relations || [];
  }
  return [];
}
```

---

## 2. `chat/index.ts`

**Purpose**: RAG chat with SSE streaming. Retrieves context via vector search and/or knowledge graph, then streams an LLM response.

**Input**: `POST { session_id: number, message: string, retrieval_mode?: "mix" | "relation_only" | "global" | "human_in_the_loop" }`  
**Auth**: Bearer token (user JWT or service_role)  
**Output**: SSE stream (OpenAI-compatible `data: {...}` format)

```typescript
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
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // --- AUTH ---
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

    // --- VERIFY SESSION OWNERSHIP ---
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("chat_sessions")
      .select("*, projects!inner(id, owner_id, default_system_prompt, conversation_memory_window)")
      .eq("id", session_id)
      .single();
    if (sessionError || !session) throw new Error("Session not found");
    if (!isServiceRole && (session as any).projects?.owner_id !== userId) throw new Error("Access denied");

    const project = (session as any).projects;
    const projectId = project.id;

    // --- SAVE USER MESSAGE ---
    const { data: userMsg } = await supabaseAdmin
      .from("chat_messages")
      .insert({ chat_session_id: session_id, role: "user", content: message })
      .select("id")
      .single();

    // --- GET CONVERSATION HISTORY ---
    const { data: history } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("chat_session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(project.conversation_memory_window * 2);

    // --- RETRIEVAL ---
    let contextChunks: any[] = [];
    let retrievalInfo = { mode: retrieval_mode, chunks_used: 0, agentic_rounds: 0 };

    // Vector similarity search
    if (retrieval_mode === "mix" || retrieval_mode === "global") {
      const queryEmbedding = await generateQueryEmbedding(message, lovableApiKey);
      if (queryEmbedding) {
        const { data: matchedChunks } = await supabaseAdmin.rpc("match_chunks", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_project_id: projectId,
          match_threshold: 0.3,  // Lowered from default 0.5 for chat-based embeddings
          match_count: retrieval_mode === "global" ? 15 : 8,
        });
        contextChunks = matchedChunks || [];
      }
    }

    // Graph-based retrieval
    if (retrieval_mode === "mix" || retrieval_mode === "relation_only") {
      const graphChunks = await getGraphContext(supabaseAdmin, projectId, message);
      const existingIds = new Set(contextChunks.map((c: any) => c.id));
      for (const gc of graphChunks) {
        if (!existingIds.has(gc.id)) {
          contextChunks.push(gc);
        }
      }
    }

    retrievalInfo.chunks_used = contextChunks.length;

    // --- BUILD CONTEXT STRING ---
    const contextStr = contextChunks.length > 0
      ? contextChunks
          .map((c: any, i: number) => `[Source ${i + 1}] (chunk ${c.chunk_index}, similarity: ${(c.similarity || 0).toFixed(2)})\n${c.content}`)
          .join("\n\n---\n\n")
      : "No relevant context found in the knowledge base.";

    // --- BUILD LLM MESSAGES ---
    const systemPrompt = `${project.default_system_prompt}

You have access to the following context from the knowledge base. Use it to answer the user's question accurately. Always cite your sources using [Source N] notation when using information from the context.

CONTEXT:
${contextStr}`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-project.conversation_memory_window * 2),
    ];

    // --- STREAM LLM RESPONSE ---
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

    // --- INTERCEPT STREAM TO SAVE RESPONSE ---
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

        // Save assistant message and retrieval event
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

          // Auto-title session from first message
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

// =============================================================================
// HELPER: generateQueryEmbedding (same algorithm as process-document)
// =============================================================================

async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "Extract a semantic fingerprint from the text. Return exactly 30 key concepts/topics with relevance weights (0.0-1.0). Be consistent: similar texts should produce similar concepts. Focus on concrete nouns, verbs, and domain terms.",
          },
          { role: "user", content: text.slice(0, 1000) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_fingerprint",
              description: "Return semantic fingerprint as concept-weight pairs",
              parameters: {
                type: "object",
                properties: {
                  concepts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        concept: { type: "string", description: "A key concept, topic, or theme (lowercase, 1-3 words)" },
                        weight: { type: "number", description: "Relevance weight from 0.0 to 1.0" },
                      },
                      required: ["concept", "weight"],
                      additionalProperties: false,
                    },
                    description: "Exactly 30 concept-weight pairs",
                  },
                },
                required: ["concepts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_fingerprint" } },
      }),
    });

    if (!response.ok) {
      await response.text();
      return textToHashVector(text);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (Array.isArray(parsed.concepts) && parsed.concepts.length > 0) {
        return conceptsToVector(parsed.concepts);
      }
    }
    return textToHashVector(text);
  } catch (e) {
    console.error("Query embedding failed:", e);
    return textToHashVector(text);
  }
}

// conceptsToVector and textToHashVector are identical to process-document
// (see above for full implementation)

function conceptsToVector(concepts: Array<{ concept: string; weight: number }>): number[] {
  const vec = new Float64Array(768);
  for (const { concept, weight } of concepts) {
    const w = Math.max(0, Math.min(1, weight));
    for (let i = 0; i < concept.length; i++) {
      const code = concept.charCodeAt(i);
      for (let h = 0; h < 8; h++) {
        const idx = ((code * 31 + i * 97 + h * 53) & 0x7FFFFFFF) % 768;
        const sign = ((code * 17 + h * 41 + i) % 2 === 0) ? 1 : -1;
        vec[idx] += sign * w * (1 / (1 + i * 0.1));
      }
    }
    for (let i = 0; i < concept.length - 1; i++) {
      const bigram = concept.charCodeAt(i) * 256 + concept.charCodeAt(i + 1);
      const idx = (bigram * 37) % 768;
      const sign = (bigram % 2 === 0) ? 1 : -1;
      vec[idx] += sign * w * 0.5;
    }
  }
  let norm = 0;
  for (let i = 0; i < 768; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 768; i++) vec[i] /= norm;
  }
  return Array.from(vec);
}

function textToHashVector(text: string): number[] {
  const vec = new Float64Array(768);
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    const trigram = lower.charCodeAt(i) * 65536 + lower.charCodeAt(i + 1) * 256 + lower.charCodeAt(i + 2);
    const idx = (trigram * 31) % 768;
    const sign = (trigram % 2 === 0) ? 1 : -1;
    vec[idx] += sign;
  }
  let norm = 0;
  for (let i = 0; i < 768; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 768; i++) vec[i] /= norm;
  }
  return Array.from(vec);
}

// =============================================================================
// HELPER: getGraphContext
// =============================================================================
// Finds entities whose names appear in the query, follows their relations,
// and returns chunks from the related documents.

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
```

---

## Configuration

Both functions are configured in `supabase/config.toml`:

```toml
project_id = "cnpwjnmopjotgvthgenx"

[functions.process-document]
verify_jwt = false

[functions.chat]
verify_jwt = false
```

`verify_jwt = false` because both functions handle authentication manually (supporting both user JWTs and service_role tokens).
