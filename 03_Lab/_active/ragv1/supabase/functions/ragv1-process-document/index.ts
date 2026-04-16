import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DB_SCHEMA = "poc_ragv1";
const CHUNK_SIZE = 1000; // tokens approx (chars / 4)
const CHUNK_OVERLAP = 200;
const GEMINI_MODEL = "gemini-2.5-flash";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSIONALITY = 1536; // IVFFlat max is 2000-dim; 1536 is optimal balance
const DOCLING_URL = Deno.env.get("DOCLING_URL") ?? "http://docling:5001";

// Cost constants (USD per 1M tokens)
const EMBED_COST_PER_M = 0.15;    // gemini-embedding-001 per 1M tokens
const LLM_INPUT_COST_PER_M = 0.10;  // gemini-2.0-flash per 1M input
const LLM_OUTPUT_COST_PER_M = 0.40; // gemini-2.0-flash per 1M output

// Sprint 3a: MIME type maps for audio and video
const AUDIO_MIME_MAP: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
};

function isAudioExtension(ext: string): boolean {
  return ext in AUDIO_MIME_MAP;
}

function isVideoExtension(ext: string): boolean {
  return ext in VIDEO_MIME_MAP;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    const storageBucket = Deno.env.get("STORAGE_BUCKET") || "poc-ragv1-docs";

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

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id is required");

    // Fetch document and verify ownership
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*, projects!inner(owner_id, id)")
      .eq("id", document_id)
      .single();
    if (docError || !doc) throw new Error("Document not found");
    if (!isServiceRole && (doc as any).projects?.owner_id !== userId) throw new Error("Access denied");

    await supabaseAdmin.from("documents").update({ status: "processing" }).eq("id", document_id);

    const projectId = (doc as any).projects.id;

    // Track total cost across this document processing run
    let totalCostUsd = 0;

    // Fetch project RAG settings (including new Sprint 2 + Sprint 3 fields)
    const { data: projectSettings } = await supabaseAdmin
      .from("project_rag_settings")
      .select(
        "enable_entity_extraction, enable_relation_extraction, chunking_strategy, chunk_token_size, " +
        "enable_deep_extract, enable_chunk_context, custom_metadata_schema"
      )
      .eq("project_id", projectId)
      .single();

    // Download and parse file based on extension
    let textContent = "";
    if (doc.source_path) {
      const { data: fileData, error: dlError } = await supabaseAdmin.storage
        .from(storageBucket)
        .download(doc.source_path);
      if (dlError) throw new Error(`Failed to download file: ${dlError.message}`);

      const filename = (doc.source_path as string).split("/").pop() ?? "";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";

      const useDocling = projectSettings?.enable_deep_extract === true;

      if (useDocling && ["pdf", "docx", "pptx", "xlsx"].includes(ext)) {
        // Docling extraction path
        try {
          const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
          textContent = await extractTextWithDocling(fileBuffer, filename);
          console.log(`Docling extracted: ${textContent.length} chars from ${filename}`);
        } catch (e) {
          console.error("Docling extraction failed, falling back:", e);
          // Fallback to existing parsers for pdf/docx
          if (ext === "pdf") {
            try {
              const { default: pdfParse } = await import("npm:pdf-parse/lib/pdf-parse.js");
              const { Buffer } = await import("node:buffer");
              const pdfData = await pdfParse(Buffer.from(await fileData.arrayBuffer()));
              textContent = pdfData.text;
            } catch {
              textContent = await fileData.text();
            }
          } else if (ext === "docx") {
            try {
              const { default: mammoth } = await import("npm:mammoth");
              const { Buffer } = await import("node:buffer");
              const result = await mammoth.extractRawText({ buffer: Buffer.from(await fileData.arrayBuffer()) });
              textContent = result.value;
            } catch {
              textContent = await fileData.text();
            }
          } else {
            textContent = await fileData.text();
          }
        }
      } else if (["pdf"].includes(ext)) {
        try {
          const { default: pdfParse } = await import("npm:pdf-parse/lib/pdf-parse.js");
          const { Buffer } = await import("node:buffer");
          const pdfData = await pdfParse(Buffer.from(await fileData.arrayBuffer()));
          textContent = pdfData.text;
          console.log(`PDF parsed: ${textContent.length} chars`);
        } catch (e) {
          console.error("PDF parse failed, trying Gemini Vision fallback:", e);
          // Gemini Vision fallback: extract text from PDF as document image
          if (googleApiKey) {
            try {
              const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
              textContent = await extractTextWithGeminiVision(fileBuffer, "application/pdf", googleApiKey);
              console.log(`Gemini Vision extracted: ${textContent.length} chars from PDF`);
            } catch (ve) {
              console.error("Gemini Vision fallback failed:", ve);
              textContent = "";
            }
          } else {
            textContent = "";
          }
        }
      } else if (["docx"].includes(ext)) {
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
      } else if (ext === "pptx") {
        try {
          const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
          const { default: officeParser } = await import("npm:officeparser");
          const text = await officeParser.parseOfficeAsync(fileBuffer);
          textContent = text;
          console.log(`PPTX parsed via officeparser: ${textContent.length} chars`);
        } catch (e) {
          console.error("officeparser PPTX failed, falling back to raw text:", e);
          try { textContent = await fileData.text(); } catch { textContent = ""; }
        }
      } else if (ext === "xlsx") {
        try {
          const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
          const XLSX = await import("npm:xlsx");
          const workbook = XLSX.read(fileBuffer, { type: "array" });
          const texts: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            texts.push(`Sheet: ${sheetName}\n` + XLSX.utils.sheet_to_csv(sheet));
          }
          textContent = texts.join("\n\n");
          console.log(`XLSX parsed via xlsx: ${textContent.length} chars`);
        } catch (e) {
          console.error("xlsx XLSX failed, falling back to raw text:", e);
          try { textContent = await fileData.text(); } catch { textContent = ""; }
        }
      } else if (isAudioExtension(ext)) {
        if (googleApiKey) {
          try {
            const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
            const mimeType = AUDIO_MIME_MAP[ext] ?? "audio/mpeg";
            const fileUri = await uploadToGeminiFileAPI(fileBuffer, mimeType, filename, googleApiKey);
            textContent = await transcribeWithGeminiFileAPI(
              fileUri, mimeType,
              "Transcribe this audio recording completely and accurately.",
              googleApiKey
            );
            console.log(`Audio transcribed: ${textContent.length} chars from ${filename}`);
          } catch (e) {
            console.error("Audio transcription failed:", e);
            textContent = "";
          }
        } else {
          console.warn("GOOGLE_API_KEY not set — cannot transcribe audio");
          textContent = "";
        }
      } else if (isVideoExtension(ext)) {
        if (googleApiKey) {
          try {
            const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
            const mimeType = VIDEO_MIME_MAP[ext] ?? "video/mp4";
            const fileUri = await uploadToGeminiFileAPI(fileBuffer, mimeType, filename, googleApiKey);
            textContent = await transcribeWithGeminiFileAPI(
              fileUri, mimeType,
              "Transcribe all speech and describe key visual content in this video.",
              googleApiKey
            );
            console.log(`Video transcribed: ${textContent.length} chars from ${filename}`);
          } catch (e) {
            console.error("Video transcription failed:", e);
            textContent = "";
          }
        } else {
          console.warn("GOOGLE_API_KEY not set — cannot transcribe video");
          textContent = "";
        }
      } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
        if (googleApiKey) {
          try {
            const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
            const mimeMap: Record<string, string> = {
              jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
              gif: "image/gif", webp: "image/webp",
            };
            const mimeType = mimeMap[ext] ?? "image/jpeg";
            textContent = await extractTextWithGeminiVision(fileBuffer, mimeType, googleApiKey);
            console.log(`Vision extracted: ${textContent.length} chars from ${filename}`);
          } catch (e) {
            console.error("Gemini Vision extraction failed:", e);
            textContent = "";
          }
        } else {
          console.warn("GOOGLE_API_KEY not set — cannot extract text from image");
          textContent = "";
        }
      } else if (["txt", "md"].includes(ext)) {
        textContent = await fileData.text();
      } else if (ext === "gdoc") {
        // .gdoc files are Google Docs pointer files (JSON), not actual document content
        await supabaseAdmin.from("documents").update({ status: "error" }).eq("id", document_id);
        throw new Error("Google Docs .gdoc files are not supported. Please export your Google Doc as PDF or DOCX and re-upload.");
      } else {
        // Unknown extension — best-effort text
        try {
          textContent = await fileData.text();
        } catch {
          textContent = "";
        }
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
    const rawStrategy = projectSettings?.chunking_strategy ?? "standard";
    const chunkTokenSize = projectSettings?.chunk_token_size ?? CHUNK_SIZE;
    const chunkSizeChars = chunkTokenSize * 4;
    const overlapChars = CHUNK_OVERLAP * 4;
    const enableChunkContext = projectSettings?.enable_chunk_context === true;

    // enable_chunk_context flag forces contextual strategy regardless of chunking_strategy setting
    const strategy = enableChunkContext ? "contextual" : rawStrategy;

    const { chunks, addedCost } = await chunkDocumentWithCost(
      textContent, strategy, chunkSizeChars, overlapChars,
      googleApiKey ?? null, supabaseAdmin, projectId
    );
    totalCostUsd += addedCost;

    console.log(`Document ${document_id}: created ${chunks.length} chunks (strategy: ${strategy})`);

    // Sanitize chunk content: remove null bytes and invalid Unicode that break JSON serialization
    const sanitize = (s: string) => s.replace(/\0/g, "").replace(/[\uFFFE\uFFFF]/g, "");

    const chunkRows = chunks.map((content, index) => ({
      document_id,
      content: sanitize(content),
      chunk_index: index,
      metadata: {},
      status: "processed" as const,
    }));

    const { data: insertedChunks, error: chunkError } = await supabaseAdmin
      .from("document_chunks")
      .insert(chunkRows)
      .select("id, chunk_index");
    if (chunkError) throw new Error(`Failed to insert chunks: ${chunkError.message}`);

    // --- Sprint 3b: Custom metadata extraction ---
    const customSchema = (projectSettings as any)?.custom_metadata_schema;
    if (customSchema && typeof customSchema === "object" && !Array.isArray(customSchema) && Object.keys(customSchema).length > 0 && googleApiKey && insertedChunks && insertedChunks.length > 0) {
      const schemaKeys = Object.keys(customSchema).length;
      const chunksToProcess = chunks.slice(0, 50);
      console.log(`Custom metadata extraction: ${chunksToProcess.length} chunks, schema keys: ${schemaKeys}`);
      for (let i = 0; i < chunksToProcess.length; i++) {
        const chunk = chunksToProcess[i];
        const chunkRecord = insertedChunks?.find((c: any) => c.chunk_index === i);
        if (!chunkRecord) continue;
        try {
          const prompt = `Extract the following fields from this passage as JSON. Only include fields that are clearly present. Schema: ${JSON.stringify(customSchema)}\n\nPassage: ${chunk}`;
          const { text: raw, inputTokens, outputTokens } = await callGemini(prompt, googleApiKey);
          const metaCost =
            (inputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
            (outputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;
          totalCostUsd += metaCost;
          await logCost(supabaseAdmin, projectId, "metadata_extract", GEMINI_MODEL, inputTokens, outputTokens, metaCost);

          let extracted: unknown = null;
          try { extracted = JSON.parse(raw.trim()); } catch { /* non-JSON response — skip */ }

          if (extracted !== null && typeof extracted === "object" && !Array.isArray(extracted)) {
            await supabaseAdmin
              .from("document_chunks")
              .update({ metadata: extracted })
              .eq("id", chunkRecord.id);
          }
        } catch (e) {
          console.error(`Custom metadata extraction failed for chunk index ${i}:`, e);
        }
      }
    }

    // --- Embedding via gemini-embedding-001 (1536 dims) ---
    if (googleApiKey) {
      for (const chunk of chunks) {
        const chunkRecord = insertedChunks?.find((c: any) => c.chunk_index === chunks.indexOf(chunk));
        if (!chunkRecord) continue;
        try {
          const { values: embedding, tokenCount } = await generateEmbedding(chunk, googleApiKey);
          if (embedding) {
            await supabaseAdmin
              .from("document_chunks")
              .update({ embedding: JSON.stringify(embedding) })
              .eq("id", chunkRecord.id);

            const embedCost = (tokenCount / 1_000_000) * EMBED_COST_PER_M;
            totalCostUsd += embedCost;
            await logCost(
              supabaseAdmin,
              projectId,
              "embed",
              EMBED_MODEL,
              tokenCount,
              0,
              embedCost
            );
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
      console.warn("GOOGLE_API_KEY not set — skipping embedding (vector search will not work)");
    }

    // --- Entity + relation extraction via Gemini ---
    if (projectSettings?.enable_entity_extraction && googleApiKey) {
      try {
        const { entities, inputTokens: entityInputTokens, outputTokens: entityOutputTokens } =
          await extractEntities(textContent.slice(0, 8000), googleApiKey);

        const entityCost =
          (entityInputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
          (entityOutputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;
        totalCostUsd += entityCost;
        await logCost(
          supabaseAdmin,
          projectId,
          "entity_extract",
          GEMINI_MODEL,
          entityInputTokens,
          entityOutputTokens,
          entityCost
        );

        if (entities.length > 0) {
          const entityRows = entities.map((e: any) => ({
            project_id: projectId,
            name: e.name,
            type: e.type,
            metadata: { source_document_id: document_id },
          }));
          await supabaseAdmin.from("entities").insert(entityRows);
          console.log(`Extracted ${entities.length} entities`);

          if (projectSettings?.enable_relation_extraction && entities.length >= 2) {
            const {
              relations,
              inputTokens: relInputTokens,
              outputTokens: relOutputTokens,
            } = await extractRelations(textContent.slice(0, 8000), entities, googleApiKey);

            const relCost =
              (relInputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
              (relOutputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;
            totalCostUsd += relCost;
            await logCost(
              supabaseAdmin,
              projectId,
              "entity_extract",
              GEMINI_MODEL,
              relInputTokens,
              relOutputTokens,
              relCost
            );

            if (relations.length > 0) {
              const { data: dbEntities } = await supabaseAdmin
                .from("entities")
                .select("id, name")
                .eq("project_id", projectId);
              const nameToId = new Map((dbEntities || []).map((e: any) => [e.name.toLowerCase(), e.id]));

              const relationRows = relations
                .map((r: any) => {
                  const sourceId = nameToId.get(r.source?.toLowerCase());
                  const targetId = nameToId.get(r.target?.toLowerCase());
                  if (!sourceId || !targetId) return null;
                  return {
                    project_id: projectId,
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

    // --- Increment project spend ---
    if (totalCostUsd > 0) {
      try {
        await supabaseAdmin.rpc("increment_project_spend", {
          p_project_id: projectId,
          p_amount: totalCostUsd,
        });
      } catch (e) {
        // Fallback: manual increment if RPC not available
        try {
          const { data: proj } = await supabaseAdmin
            .from("projects")
            .select("current_spend_usd")
            .eq("id", projectId)
            .single();
          const current = (proj as any)?.current_spend_usd ?? 0;
          await supabaseAdmin
            .from("projects")
            .update({ current_spend_usd: current + totalCostUsd })
            .eq("id", projectId);
        } catch (e2) {
          console.error("Failed to update project spend:", e2);
        }
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
      JSON.stringify({ success: true, chunks_created: chunks.length, document_id, total_cost_usd: totalCostUsd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ragv1-process-document error:", e);
    // Update document status to error so UI reflects failure
    if (typeof document_id === "number") {
      await supabaseAdmin.from("documents").update({ status: "error" }).eq("id", document_id).catch(() => {});
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Helper Functions ---

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
    if (end >= text.length) break;
    start += Math.max(chunk.length - overlap, 1);
  }
  return chunks.filter((c) => c.length > 0);
}

// --- Sprint 2a: Docling extraction ---

async function extractTextWithDocling(fileBuffer: Uint8Array, filename: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append("files", blob, filename);

  const response = await fetch(`${DOCLING_URL}/v1/convert/file`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Docling API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const mdContent = data?.document?.md_content;
  if (typeof mdContent !== "string") {
    throw new Error("Docling response missing document.md_content");
  }
  return mdContent;
}

// --- Sprint 2b: Gemini Vision extraction ---

async function extractTextWithGeminiVision(
  fileBuffer: Uint8Array,
  mimeType: string,
  apiKey: string
): Promise<string> {
  // Convert buffer to base64
  let binary = "";
  const bytes = new Uint8Array(fileBuffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: "Extract all text from this image exactly as written. Preserve tables and structure." },
          ],
        }],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Vision API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini Vision response missing text");
  }
  return text;
}

// --- Sprint 2c: Chunking strategies ---

/**
 * Chunk document using the selected strategy.
 * Returns both the chunks array and the additional LLM cost incurred (for contextual).
 */
async function chunkDocumentWithCost(
  text: string,
  strategy: string,
  chunkSize: number,
  overlap: number,
  googleApiKey: string | null,
  supabase: any,
  projectId: number
): Promise<{ chunks: string[]; addedCost: number }> {
  let addedCost = 0;

  switch (strategy) {
    case "contextual": {
      if (!googleApiKey) {
        console.warn("contextual strategy requires GOOGLE_API_KEY — falling back to standard");
        return { chunks: chunkText(text, chunkSize, overlap), addedCost };
      }
      const baseChunks = chunkText(text, chunkSize, overlap);
      const contextualChunks: string[] = [];
      for (const chunk of baseChunks) {
        try {
          const prompt = `In one sentence, what is this passage about? Passage: ${chunk}`;
          const { text: sentence, inputTokens, outputTokens } = await callGemini(prompt, googleApiKey);
          const cost =
            (inputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
            (outputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;
          addedCost += cost;
          await logCost(supabase, projectId, "chunk_context", GEMINI_MODEL, inputTokens, outputTokens, cost);
          contextualChunks.push(`Context: ${sentence.trim()}\n\n${chunk}`);
        } catch (e) {
          console.error("Contextual chunk context generation failed:", e);
          contextualChunks.push(chunk);
        }
      }
      return { chunks: contextualChunks, addedCost };
    }

    case "semantic": {
      // Split at paragraph boundaries; fall back to chunkText for oversized paragraphs
      const paragraphs = text.split(/\n\n+/);
      const chunks: string[] = [];
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;
        if (trimmed.length > chunkSize) {
          // Oversized paragraph — fall back to fixed-size chunking
          chunks.push(...chunkText(trimmed, chunkSize, overlap));
        } else {
          chunks.push(trimmed);
        }
      }
      return { chunks: chunks.filter((c) => c.length > 0), addedCost };
    }

    case "page_based": {
      // Split at Docling page break markers (---) or # Page headings
      const pagePattern = /(?:^---$|^# Page\b)/m;
      const pages = text.split(pagePattern);
      const chunks: string[] = [];
      for (const page of pages) {
        const trimmed = page.trim();
        if (!trimmed) continue;
        if (trimmed.length > chunkSize) {
          chunks.push(...chunkText(trimmed, chunkSize, overlap));
        } else {
          chunks.push(trimmed);
        }
      }
      return { chunks: chunks.filter((c) => c.length > 0), addedCost };
    }

    case "standard":
    default:
      return { chunks: chunkText(text, chunkSize, overlap), addedCost };
  }
}

async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<{ values: number[] | null; tokenCount: number }> {
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
    const err = await response.text();
    throw new Error(`Google Embedding API ${response.status}: ${err}`);
  }
  const data = await response.json();
  const values = data.embedding?.values ?? null;
  const tokenCount = data.usageMetadata?.tokenCount ?? Math.ceil(text.length / 4);
  return { values, tokenCount };
}

async function callGemini(
  prompt: string,
  apiKey: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch(
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
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API ${response.status}: ${err}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);
  return { text, inputTokens, outputTokens };
}

async function extractEntities(
  text: string,
  apiKey: string
): Promise<{ entities: Array<{ name: string; type: string }>; inputTokens: number; outputTokens: number }> {
  const prompt = `Extract named entities from the following text. Return ONLY a JSON object with an "entities" array.
Each entity has "name" (string) and "type" (one of: organization, person, product, date, concept, event, technology, location, other).

Text:
${text}

Return format: {"entities": [{"name": "...", "type": "..."}]}`;

  try {
    const { text: raw, inputTokens, outputTokens } = await callGemini(prompt, apiKey);
    const parsed = JSON.parse(raw.trim());
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      inputTokens,
      outputTokens,
    };
  } catch (e) {
    console.error("extractEntities parse failed:", e);
    return { entities: [], inputTokens: 0, outputTokens: 0 };
  }
}

async function extractRelations(
  text: string,
  entities: Array<{ name: string; type: string }>,
  apiKey: string
): Promise<{
  relations: Array<{ source: string; target: string; relation_type: string }>;
  inputTokens: number;
  outputTokens: number;
}> {
  const entityList = entities.map((e) => `${e.name} (${e.type})`).join(", ");

  const prompt = `Given these entities: ${entityList}

Extract relationships between them from the following text. Return ONLY a JSON object with a "relations" array.
Each relation has "source" (entity name), "target" (entity name), and "relation_type" (string describing the relationship).
Use entity names exactly as given above.

Text:
${text}

Return format: {"relations": [{"source": "...", "target": "...", "relation_type": "..."}]}`;

  try {
    const { text: raw, inputTokens, outputTokens } = await callGemini(prompt, apiKey);
    const parsed = JSON.parse(raw.trim());
    return {
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      inputTokens,
      outputTokens,
    };
  } catch (e) {
    console.error("extractRelations parse failed:", e);
    return { relations: [], inputTokens: 0, outputTokens: 0 };
  }
}

// --- Sprint 3a: Gemini File API helpers (audio / video) ---

/**
 * Uploads a file buffer to the Gemini File API and returns the file URI.
 */
async function uploadToGeminiFileAPI(
  buffer: Uint8Array,
  mimeType: string,
  displayName: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Header-Content-Length": String(buffer.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "X-Goog-Upload-Protocol": "raw",
      },
      body: buffer,
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini File API upload ${response.status}: ${err}`);
  }

  const data = await response.json();
  const fileUri = data?.file?.uri;
  if (typeof fileUri !== "string") {
    throw new Error("Gemini File API response missing file.uri");
  }
  console.log(`Uploaded ${displayName} to Gemini File API: ${fileUri}`);
  return fileUri;
}

/**
 * Calls Gemini generateContent with a previously-uploaded file URI and returns the text response.
 */
async function transcribeWithGeminiFileAPI(
  fileUri: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { fileData: { mimeType, fileUri } },
            { text: prompt },
          ],
        }],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini generateContent ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini generateContent response missing text");
  }
  return text;
}
