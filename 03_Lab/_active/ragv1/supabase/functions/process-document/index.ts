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
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");

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

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id is required");

    // Fetch document and verify ownership
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*, projects!inner(owner_id)")
      .eq("id", document_id)
      .single();
    if (docError || !doc) throw new Error("Document not found");
    if (!isServiceRole && (doc as any).projects?.owner_id !== userId) throw new Error("Access denied");

    await supabaseAdmin.from("documents").update({ status: "processing" }).eq("id", document_id);

    // Download and parse file based on extension
    let textContent = "";
    if (doc.source_path) {
      const { data: fileData, error: dlError } = await supabaseAdmin.storage
        .from("documents")
        .download(doc.source_path);
      if (dlError) throw new Error(`Failed to download file: ${dlError.message}`);

      const ext = (doc.source_path as string).split(".").pop()?.toLowerCase() ?? "";

      if (ext === "pdf") {
        try {
          const { default: pdfParse } = await import("npm:pdf-parse/lib/pdf-parse.js");
          const { Buffer } = await import("node:buffer");
          const pdfData = await pdfParse(Buffer.from(await fileData.arrayBuffer()));
          textContent = pdfData.text;
          console.log(`PDF parsed: ${textContent.length} chars`);
        } catch (e) {
          console.error("PDF parse failed, falling back to raw text:", e);
          textContent = await fileData.text();
        }
      } else if (ext === "docx") {
        try {
          const { default: mammoth } = await import("npm:mammoth");
          const { Buffer } = await import("node:buffer");
          const result = await mammoth.extractRawText({ buffer: Buffer.from(await fileData.arrayBuffer()) });
          textContent = result.value;
          console.log(`DOCX parsed: ${textContent.length} chars`);
        } catch (e) {
          console.error("DOCX parse failed, falling back to raw text:", e);
          textContent = await fileData.text();
        }
      } else {
        textContent = await fileData.text();
      }
    }

    if (!textContent.trim()) {
      await supabaseAdmin.from("documents").update({ status: "error" }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "Empty document content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Chunking ---
    const chunks = chunkText(textContent, CHUNK_SIZE * 4, CHUNK_OVERLAP * 4);
    console.log(`Document ${document_id}: created ${chunks.length} chunks`);

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

    // --- Embedding via Google text-embedding-004 ---
    if (googleApiKey) {
      for (const chunk of chunks) {
        const chunkRecord = insertedChunks?.find((c: any) => c.chunk_index === chunks.indexOf(chunk));
        if (!chunkRecord) continue;

        try {
          const embedding = await generateEmbedding(chunk, googleApiKey);
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
      console.warn("GOOGLE_API_KEY not set — skipping embedding generation (vector search will not work)");
    }

    // --- Entity extraction (still uses Lovable AI Gateway) ---
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

    await supabaseAdmin
      .from("documents")
      .update({ status: "processed", updated_at: new Date().toISOString() })
      .eq("id", document_id);

    await supabaseAdmin.from("chunk_processing_events").insert({
      document_id,
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, chunks_created: chunks.length, document_id }),
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

// --- Helper Functions ---

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

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

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
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
    throw new Error(`Google Embedding API ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.embedding?.values ?? null;
}

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
