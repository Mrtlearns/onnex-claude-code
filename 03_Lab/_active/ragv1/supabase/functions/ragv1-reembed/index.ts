import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DB_SCHEMA = "poc_ragv1";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSIONALITY = 1536; // IVFFlat max is 2000-dim; 1536 is optimal balance
const LOG_INTERVAL = 10;

// POST /functions/v1/ragv1-reembed
// Body: { project_id?: number, force?: boolean }
// Auth: service_role only
// Returns: { re_embedded: number, errors: number }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    // Verify service_role only
    const token = authHeader.replace("Bearer ", "");
    let isServiceRole = false;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role === "service_role") {
        isServiceRole = true;
      }
    } catch {
      isServiceRole = false;
    }

    if (!isServiceRole) {
      return new Response(
        JSON.stringify({ error: "This endpoint requires service_role authorization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!googleApiKey) throw new Error("GOOGLE_API_KEY is not configured");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: DB_SCHEMA },
    });

    const body = await req.json().catch(() => ({}));
    const projectId: number | undefined = body.project_id;
    const force: boolean = body.force === true;

    // Build query for chunks to process
    let query = supabaseAdmin
      .from("document_chunks")
      .select("id, content, document_id, documents!inner(project_id)")
      .order("id", { ascending: true });

    if (!force) {
      // Only chunks with no embedding
      query = query.is("embedding", null);
    }

    if (projectId !== undefined) {
      // Filter by project via join with documents
      query = query.eq("documents.project_id", projectId);
    }

    const { data: chunks, error: fetchError } = await query;
    if (fetchError) throw new Error(`Failed to fetch chunks: ${fetchError.message}`);

    const total = (chunks || []).length;
    console.log(`ragv1-reembed: found ${total} chunks to process (force=${force}, project_id=${projectId ?? "all"})`);

    let reEmbedded = 0;
    let errors = 0;

    for (let i = 0; i < (chunks || []).length; i++) {
      const chunk = (chunks as any[])[i];

      if (i > 0 && i % LOG_INTERVAL === 0) {
        console.log(`ragv1-reembed progress: ${i}/${total} (re_embedded=${reEmbedded}, errors=${errors})`);
      }

      try {
        const embedding = await generateEmbedding(chunk.content, googleApiKey);
        if (!embedding) {
          console.error(`Null embedding returned for chunk ${chunk.id}`);
          errors++;
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from("document_chunks")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", chunk.id);

        if (updateError) {
          console.error(`Failed to update embedding for chunk ${chunk.id}: ${updateError.message}`);
          errors++;
        } else {
          reEmbedded++;
        }
      } catch (e) {
        console.error(`Error embedding chunk ${chunk.id}:`, e);
        errors++;
      }
    }

    console.log(`ragv1-reembed complete: re_embedded=${reEmbedded}, errors=${errors}, total=${total}`);

    return new Response(
      JSON.stringify({ re_embedded: reEmbedded, errors, total }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ragv1-reembed error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Helper Functions ---

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
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
  return data.embedding?.values ?? null;
}
