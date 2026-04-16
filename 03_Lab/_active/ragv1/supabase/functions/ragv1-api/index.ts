import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DB_SCHEMA = "poc_ragv1";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSIONALITY = 1536;

// ---------------------------------------------------------------------------
// Bug 1 fix: HMAC-SHA256 for deterministic API key lookup.
// Previous code used AES-GCM with crypto.getRandomValues() for IV on every
// call — this made the encrypted value different each time, so the DB lookup
// (.eq("api_key", lookupValue)) never matched a stored row.
// HMAC-SHA256 is deterministic: same key + same secret → same digest.
// ---------------------------------------------------------------------------

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
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
      console.error(`Embedding API ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    return data.embedding?.values ?? null;
  } catch (e) {
    console.error("Embedding failed:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleApiKey = Deno.env.get("GOOGLE_API_KEY") ?? "";

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: DB_SCHEMA },
  });

  // Health check — no auth required
  const earlyUrl = new URL(req.url);
  const earlySuffix = earlyUrl.pathname.replace(/^(\/functions\/v1)?\/ragv1-api/, "");
  if (earlySuffix === "/v1/health" && req.method === "GET") {
    return jsonResponse({ status: "ok", version: "1.0" });
  }

  // --- Auth: extract Bearer token and look up project_api_keys ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  // Bug 1 fix: deterministic HMAC-SHA256 lookup (env var: API_KEY_HMAC_SECRET)
  const hmacSecret = Deno.env.get("API_KEY_HMAC_SECRET") ?? "fallback-change-in-prod";
  let lookupValue: string;
  try {
    lookupValue = await hmacSha256Hex(token, hmacSecret);
  } catch (e) {
    console.error("HMAC failed during lookup:", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }

  const { data: keyRow } = await supabaseAdmin
    .from("project_api_keys")
    .select("project_id, key_name")
    .eq("api_key", lookupValue)
    .single();

  if (!keyRow) return jsonResponse({ error: "Unauthorized" }, 401);

  const projectId: number = keyRow.project_id;

  // --- Fetch project owner for org scoping ---
  const { data: projectRow } = await supabaseAdmin
    .from("projects")
    .select("owner_id, name, description")
    .eq("id", projectId)
    .single();
  if (!projectRow) return jsonResponse({ error: "Project not found" }, 404);
  const projectOwnerId = projectRow.owner_id;

  // --- Route dispatch ---
  const url = new URL(req.url);
  const pathname = url.pathname;
  const suffix = pathname.replace(/^(\/functions\/v1)?\/ragv1-api/, "");

  try {
    // ============================================================================
    // PROJECT ENDPOINTS
    // ============================================================================

    // GET /v1/projects — list all projects owned by the project owner
    if (suffix === "/v1/projects" && req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id, name, description, created_at, updated_at")
        .eq("owner_id", projectOwnerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ projects: data ?? [] });
    }

    // GET /v1/projects/:id — get project detail
    if (suffix.match(/^\/v1\/projects\/(\d+)$/) && req.method === "GET") {
      const id = parseInt(suffix.split("/")[3]);
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("id, name, description, created_at, updated_at")
        .eq("id", id)
        .eq("owner_id", projectOwnerId)
        .single();
      if (error || !data) return jsonResponse({ error: "Project not found" }, 404);
      return jsonResponse(data);
    }

    // PATCH /v1/projects/:id — update project name/description
    if (suffix.match(/^\/v1\/projects\/(\d+)$/) && req.method === "PATCH") {
      const id = parseInt(suffix.split("/")[3]);
      const body = await req.json();
      const { name, description } = body;

      // Verify ownership
      const { data: proj } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("id", id)
        .eq("owner_id", projectOwnerId)
        .single();
      if (!proj) return jsonResponse({ error: "Project not found" }, 404);

      const { data, error } = await supabaseAdmin
        .from("projects")
        .update({ name, description, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, name, description, updated_at");
      if (error) throw error;
      return jsonResponse(data?.[0] ?? {});
    }

    // ============================================================================
    // SETTINGS ENDPOINTS
    // ============================================================================

    // GET /v1/settings — get RAG settings for this project
    if (suffix === "/v1/settings" && req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("project_rag_settings")
        .select("*")
        .eq("project_id", projectId)
        .single();
      if (error) throw error;
      return jsonResponse(data ?? {});
    }

    // PATCH /v1/settings — update RAG settings
    if (suffix === "/v1/settings" && req.method === "PATCH") {
      const body = await req.json();
      const { data, error } = await supabaseAdmin
        .from("project_rag_settings")
        .update(body)
        .eq("project_id", projectId)
        .select("*");
      if (error) throw error;
      return jsonResponse(data?.[0] ?? {});
    }

    // ============================================================================
    // CHAT ENDPOINTS
    // ============================================================================

    // GET /v1/chat/sessions — list chat sessions for this project
    if (suffix === "/v1/chat/sessions" && req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ sessions: data ?? [] });
    }

    // POST /v1/chat — send a chat message (non-streaming JSON response)
    if (suffix === "/v1/chat" && req.method === "POST") {
      const body = await req.json();
      const { session_id, message, retrieval_mode = "hybrid" } = body;
      if (!session_id || !message) {
        return jsonResponse({ error: "session_id and message are required" }, 400);
      }

      // Verify session belongs to this project
      const { data: session } = await supabaseAdmin
        .from("chat_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("project_id", projectId)
        .single();
      if (!session) return jsonResponse({ error: "Session not found" }, 404);

      // Call the chat function
      const chatUrl = `${supabaseUrl}/functions/v1/ragv1-chat`;
      const chatRes = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          session_id,
          message,
          retrieval_mode,
        }),
      });

      if (!chatRes.ok) {
        const errText = await chatRes.text();
        return jsonResponse({ error: `Chat failed: ${errText}` }, 502);
      }

      // Read SSE stream and collect response
      const reader = chatRes.body?.getReader();
      if (!reader) return jsonResponse({ error: "No response body" }, 502);

      let fullResponse = "";
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // Parse SSE format: "data: {...}\n\n"
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const rawData = line.slice(6).trim();
              if (!rawData || rawData === "[DONE]") continue;
              try {
                const data = JSON.parse(rawData);
                // OpenAI-style SSE from ragv1-chat: choices[0].delta.content
                const text = data.choices?.[0]?.delta?.content ?? data.text ?? "";
                if (text) fullResponse += text;
              } catch { /* skip non-JSON SSE data */ }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return jsonResponse({ response: fullResponse, session_id });
    }

    // ============================================================================
    // EVALUATION ENDPOINTS
    // ============================================================================

    // POST /v1/eval — trigger eval scoring for a retrieval event
    if (suffix === "/v1/eval" && req.method === "POST") {
      const body = await req.json();
      const { retrieval_event_id } = body;
      if (!retrieval_event_id) {
        return jsonResponse({ error: "retrieval_event_id is required" }, 400);
      }

      const evalUrl = `${supabaseUrl}/functions/v1/ragv1-eval`;
      const evalRes = await fetch(evalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ retrieval_event_id }),
      });

      if (!evalRes.ok) {
        const errText = await evalRes.text();
        return jsonResponse({ error: `Eval failed: ${errText}` }, 502);
      }

      const result = await evalRes.json();
      return jsonResponse(result);
    }

    // GET /v1/eval/results — list eval results for this project
    if (suffix === "/v1/eval/results" && req.method === "GET") {
      const { data: sessions } = await supabaseAdmin
        .from("chat_sessions")
        .select("id")
        .eq("project_id", projectId);
      const sessionIds = (sessions ?? []).map((s: any) => s.id);

      if (sessionIds.length === 0) {
        return jsonResponse({ results: [] });
      }

      const { data: events } = await supabaseAdmin
        .from("chat_retrieval_events")
        .select("id")
        .in("chat_session_id", sessionIds);
      const eventIds = (events ?? []).map((e: any) => e.id);

      if (eventIds.length === 0) {
        return jsonResponse({ results: [] });
      }

      const { data, error } = await supabaseAdmin
        .from("eval_results")
        .select("*")
        .in("retrieval_event_id", eventIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return jsonResponse({ results: data ?? [] });
    }

    // ============================================================================
    // ORGANIZATION ENDPOINTS
    // ============================================================================

    // GET /v1/orgs — list orgs the project owner belongs to (owned + member)
    if (suffix === "/v1/orgs" && req.method === "GET") {
      // Query owned orgs
      const { data: ownedOrgs, error: ownedErr } = await supabaseAdmin
        .from("organizations")
        .select("id, name, slug, created_at")
        .eq("owner_id", projectOwnerId)
        .order("created_at", { ascending: false });
      if (ownedErr) throw ownedErr;

      // Query member orgs (where user is a member but not owner)
      const { data: memberRows } = await supabaseAdmin
        .from("org_members")
        .select("org_id")
        .eq("user_id", projectOwnerId);
      const memberOrgIds = (memberRows ?? []).map((r: any) => r.org_id);

      let memberOrgs: any[] = [];
      if (memberOrgIds.length > 0) {
        const { data: mo } = await supabaseAdmin
          .from("organizations")
          .select("id, name, slug, created_at")
          .in("id", memberOrgIds)
          .neq("owner_id", projectOwnerId);
        memberOrgs = mo ?? [];
      }

      const ownedIds = new Set((ownedOrgs ?? []).map((o: any) => o.id));
      const all = [...(ownedOrgs ?? []), ...memberOrgs.filter((o: any) => !ownedIds.has(o.id))];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return jsonResponse({ organizations: all });
    }

    // POST /v1/orgs — create a new org
    if (suffix === "/v1/orgs" && req.method === "POST") {
      const body = await req.json();
      const { name, slug } = body;
      if (!name || !slug) {
        return jsonResponse({ error: "name and slug are required" }, 400);
      }

      const { data, error } = await supabaseAdmin
        .from("organizations")
        .insert({ name, slug, owner_id: projectOwnerId })
        .select("id, name, slug, created_at");
      if (error) throw error;
      return jsonResponse(data?.[0] ?? {});
    }

    // ============================================================================
    // DOCUMENT ENDPOINTS (existing)
    // ============================================================================

    // GET /v1/documents
    if (suffix === "/v1/documents" && req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("documents")
        .select("id, name, status, mime_type, created_at, updated_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse({ documents: data ?? [] });
    }

    // POST /v1/documents — trigger processing of an existing document
    if (suffix === "/v1/documents" && req.method === "POST") {
      const body = await req.json();
      const { document_id } = body;
      if (!document_id) return jsonResponse({ error: "document_id is required" }, 400);

      // Verify the document belongs to this project
      const { data: doc, error: docError } = await supabaseAdmin
        .from("documents")
        .select("id")
        .eq("id", document_id)
        .eq("project_id", projectId)
        .single();
      if (docError || !doc) return jsonResponse({ error: "Document not found" }, 404);

      const processUrl = `${supabaseUrl}/functions/v1/ragv1-process-document`;
      const processRes = await fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ document_id }),
      });

      if (!processRes.ok) {
        const errText = await processRes.text();
        return jsonResponse({ error: `Processing trigger failed: ${errText}` }, 502);
      }

      return jsonResponse({ status: "processing_started", document_id });
    }

    // POST /v1/query
    if (suffix === "/v1/query" && req.method === "POST") {
      const body = await req.json();
      const { query, match_count = 8, threshold = 0.3 } = body;
      if (!query) return jsonResponse({ error: "query is required" }, 400);
      if (!googleApiKey) return jsonResponse({ error: "GOOGLE_API_KEY not configured" }, 500);

      const embedding = await generateEmbedding(query, googleApiKey);
      if (!embedding) return jsonResponse({ error: "Embedding generation failed" }, 500);

      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc("match_chunks", {
        query_embedding: JSON.stringify(embedding),
        match_project_id: projectId,
        match_threshold: threshold,
        match_count: match_count,
      });

      if (rpcError) throw rpcError;

      // Bug 2 fix: use c.metadata (document_chunks column) not c.global_metadata
      // (global_metadata is on documents table, not document_chunks)
      const result = (chunks ?? []).map((c: any) => ({
        id: c.id,
        content: c.content,
        similarity: c.similarity,
        metadata: c.metadata ?? {},
      }));

      return jsonResponse({ chunks: result });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (e: any) {
    console.error("ragv1-api error:", e);
    return jsonResponse({ error: e.message ?? "Internal server error" }, 500);
  }
});
