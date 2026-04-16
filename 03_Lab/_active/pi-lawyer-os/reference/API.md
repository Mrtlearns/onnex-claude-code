# PI Lawyer OS — API Reference

> Last updated: 2026-03-20
> Covers changes through: 0323e1a (Phase 12 — Platform Scale, v4.1 complete)
> Auth: Bearer JWT (staff) or Bearer JWT (portal/client_user)
> Base URLs:
>   - Auth:     `http://<host>/auth`
>   - API:      `http://<host>/api`   (PostgREST)
>   - AI:       `http://<host>/ai`
>   - Files:    `http://<host>/files`
>   - OpenClaw: `http://<host>/openclaw`

---

## Auth Service (`/auth`)

Custom FastAPI service. JWT expiry: 12h staff, 24h portal.

---

### GET /auth/health

Liveness probe.

**Response:**
```json
{ "status": "ok" }
```

---

### POST /auth/login

Staff login. Returns JWT with PostgREST-compatible claims and firm branding.

**Body:**
```json
{ "email": "string", "password": "string" }
```

**Response:**
```json
{
  "token": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "role": "admin|attorney|paralegal",
    "firm_id": "uuid"
  },
  "firm": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "logo_url": "string|null",
    "primary_color": "string",
    "sms_signature": "string"
  }
}
```

**JWT claims:**
```json
{
  "sub": "user_uuid",
  "role": "web_user",
  "firm_id": "uuid",
  "user_role": "admin|attorney|paralegal",
  "email": "string",
  "iat": "...",
  "exp": "..."
}
```

**Errors:** 401 invalid credentials, 403 account deactivated (users.active = false)

---

### GET /auth/me

Returns current user info. Requires staff JWT.

**Response:**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "role": "string",
  "firm_id": "uuid",
  "firm_name": "string",
  "firm_slug": "string"
}
```

---

### POST /auth/intake

**Public endpoint — no auth required.** Creates a lead from the public intake form.

**Body:**
```json
{
  "first_name": "string",
  "last_name": "string",
  "phone": "string",
  "email": "string|null",
  "injury_type": "string",
  "date_of_loss": "date|null",
  "fault": "yes|no|unsure|null",
  "has_medical": "boolean|null",
  "firm_slug": "string",
  "notes": "string|null"
}
```

**Response (201):**
```json
{ "id": "uuid", "status": "new" }
```

**Errors:** 404 firm not found

---

### POST /auth/portal-login

Client portal login. Returns JWT with `role=client_user`.

**Body:**
```json
{
  "firm_slug": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "string",
  "client_id": "uuid",
  "case_id": "uuid|null"
}
```

**JWT claims:** `role=client_user`, `firm_id`, `client_id`

**Errors:** 401 invalid credentials, 403 account disabled

---

### POST /auth/portal-register

Staff creates a portal login for a client. Requires staff JWT.

**Body:**
```json
{
  "client_id": "uuid",
  "email": "string",
  "password": "string"
}
```

**Response (201):**
```json
{ "id": "uuid", "email": "string", "client_id": "uuid" }
```

**Errors:** 404 client not found, 409 email already registered

---

### GET /auth/list-users

List all staff users for the caller's firm. Requires staff JWT (admin only).

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "role": "admin|attorney|paralegal",
    "active": true
  }
]
```

---

### POST /auth/create-user

Create a new staff user. Requires staff JWT (admin only).

**Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "admin|attorney|paralegal"
}
```

**Response (201):**
```json
{ "id": "uuid", "email": "string", "name": "string", "role": "string" }
```

**Errors:** 403 not admin, 409 email already exists

---

### PATCH /auth/update-user/:id

Update a staff user (e.g. deactivate). Requires staff JWT (admin only).

**Body:** (all fields optional)
```json
{
  "name": "string",
  "role": "admin|attorney|paralegal",
  "active": false
}
```

**Response:**
```json
{ "id": "uuid", "name": "string", "role": "string", "active": false }
```

**Errors:** 403 not admin, 404 user not found

---

### GET /auth/openclaw-token

Returns the OpenClaw gateway token for iframe auth. Requires staff JWT.

**Response:**
```json
{ "token": "string" }
```

**Errors:** 403 not authorized, 503 token not configured

---

### GET /auth/llm-settings

Returns the current LLM configuration for the caller's firm. Creates defaults (`openrouter/auto`) on first call. Requires staff JWT.

**Response:**
```json
{ "llm_provider": "openrouter", "llm_model": "auto" }
```

---

### PUT /auth/llm-settings

Updates LLM config in `firm_settings` and rewrites `openclaw.json` via bind mount. Requires staff JWT.

**Body:**
```json
{ "llm_provider": "openrouter|anthropic", "llm_model": "auto|gpt-4o|claude-sonnet|claude-haiku|gemini-pro" }
```

**Response:**
```json
{
  "llm_provider": "string",
  "llm_model": "string",
  "openclaw_model": "openrouter/auto",
  "config_written": true,
  "restart_required": true
}
```

**Notes:** `config_written: false` if the openclaw config volume isn't mounted (non-fatal). Container restart required for model change to take effect.

**Provider/Model map:**
| provider | model | openclaw_model string |
|----------|-------|----------------------|
| openrouter | auto | `openrouter/auto` |
| openrouter | gpt-4o | `openrouter/openai/gpt-4o` |
| openrouter | claude-sonnet | `openrouter/anthropic/claude-sonnet-4-5` |
| openrouter | gemini-pro | `openrouter/google/gemini-pro-1.5` |
| anthropic | claude-sonnet | `anthropic/claude-sonnet-4-6` |
| anthropic | claude-haiku | `anthropic/claude-haiku-4-5-20251001` |

---

## PostgREST API (`/api`)

Auto-generated REST from PostgreSQL schema. All requests require staff JWT (`Authorization: Bearer <token>`). RLS automatically scopes every query to `firm_id` from JWT. No explicit `firm_id` filter needed.

All tables support: `GET` (list/filter), `POST` (create), `PATCH` (update), `DELETE` (delete).

### Core Tables

| Table | PostgREST path | Notes |
|-------|---------------|-------|
| firms | `/api/firms` | Includes branding + SMTP + Stripe columns |
| users | `/api/users` | Staff accounts; `active` column for deactivation |
| leads | `/api/leads` | Includes `lead_score`, `is_duplicate`, `date_of_loss`, `fault`, `has_medical`, `preferred_language` |
| communications | `/api/communications` | `lead_id`, `channel` (sms/email/voicemail/call), `direction`, `message` |
| cases | `/api/cases` | `status`, `client_id`, `lead_id`, `sol_date`, `attorney_fee_pct` |
| clients | `/api/clients` | `insurance_carrier`, `insurance_adjuster`, `preferred_language` |
| tasks | `/api/tasks` | `case_id`, `task_type`, `due_date`, `status` |
| documents | `/api/documents` | `case_id`, `doc_type`, `shared_with_client` |
| medical_providers | `/api/medical_providers` | `case_id`, `provider_type`, `lien_amount`, `request_status` |
| partners | `/api/partners` | `partner_type`, `active` |
| partner_referrals | `/api/partner_referrals` | `partner_id`, `lead_id`, `case_id`, `commission_pct`, `commission_paid` |
| settlement_offers | `/api/settlement_offers` | `case_id`, `offer_by`, `amount`, `accepted` |
| case_costs | `/api/case_costs` | `case_id`, `cost_type`, `amount`, `paid` |
| case_settlements | `/api/case_settlements` | `case_id` 1:1; `gross_settlement`, computed `attorney_fee_amount`, `net_to_client` |
| demand_letters | `/api/demand_letters` | `case_id`, `content`, `status` |
| ai_analyses | `/api/ai_analyses` | `document_id`, `analysis_type`, `result` |
| client_users | `/api/client_users` | Portal accounts — staff-managed |
| firm_settings | `/api/firm_settings` | LLM config per firm |
| audit_log | `/api/audit_log` | `entity_type`, `entity_id`, `action`, `actor_id`, `old_values`, `new_values`, `created_at` |
| document_chunks | `/api/document_chunks` | RAG embeddings — `document_id FK`, `chunk_index`, `content`, `embedding vector(1536)` |
| objection_library | `/api/objection_library` | `category`, `objection`, `response`, `active` |
| document_templates | `/api/document_templates` | `template_type`, `name`, `content` (Markdown with `{{var}}` placeholders), `active` |

### Analytics Views (read-only)

| View | Path | Description |
|------|------|-------------|
| lead_funnel_stats | `/api/lead_funnel_stats` | Lead counts grouped by status |
| case_stage_stats | `/api/case_stage_stats` | Case counts grouped by status |
| partner_performance | `/api/partner_performance` | Referral counts + commission totals per partner |
| monthly_intake | `/api/monthly_intake` | Lead creation counts by month |
| source_attribution_stats | `/api/source_attribution_stats` | Lead counts + signed counts + conversion rate by source |
| attorney_performance | `/api/attorney_performance` | Cases/settlement/duration KPIs per attorney |

### Portal Role (client_user)

Portal JWT grants read access only to `cases`, `clients`, `documents` (where `shared_with_client=true`), `medical_providers`, `settlement_offers` scoped to `current_client_id()`.

---

## Files Service (`/files`)

Document storage. Allowed types: `.pdf`, `.docx`, `.doc`, `.jpg`, `.jpeg`, `.png`, `.txt`. Max size: 50 MB.

After upload, triggers async embedding via `POST /ai/embed-document` (fire-and-forget; non-fatal on failure).

---

### GET /files/health

Liveness probe.

---

### POST /files/upload

Upload a document. Requires staff JWT. Multipart form data.

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | yes | Document file |
| case_id | string (UUID) | yes | Case to attach to |
| doc_type | string | yes | e.g. `medical_record`, `demand_letter`, `police_report` |
| name | string | no | Display name (defaults to filename) |

**Response:**
```json
{
  "id": "uuid",
  "name": "string",
  "doc_type": "string",
  "case_id": "uuid",
  "file_path": "string",
  "mime_type": "string",
  "size_bytes": 12345
}
```

---

### GET /files/{id}

Stream file download. Requires staff or portal JWT. Sets `Content-Disposition: inline`.

**Errors:** 404 not found, 403 not authorized

---

## AI Service (`/ai`)

FastAPI service calling Claude API (`claude-sonnet-4-6`) and OpenRouter (`text-embedding-3-small`). All endpoints require either:
- Staff JWT: `Authorization: Bearer <token>`
- Internal service auth: `X-Internal-Key: <INTERNAL_API_KEY>` (for fire-and-forget calls from files service)

---

### GET /ai/health

Liveness probe.

---

### POST /ai/analyze-document

Run full AI analysis on an uploaded document. Extracts text and calls Claude.

**Body:**
```json
{ "document_id": "uuid" }
```

**Response:**
```json
{
  "document_id": "uuid",
  "analysis_id": "uuid",
  "analysis_type": "string",
  "result": { }
}
```

---

### POST /ai/classify-document

Auto-classify a document type.

**Body:**
```json
{ "document_id": "uuid" }
```

**Response:**
```json
{ "document_id": "uuid", "doc_type": "string", "confidence": 0.95 }
```

---

### GET /ai/analysis/{document_id}

Retrieve stored AI analysis for a document.

**Response:** Stored `ai_analyses` row or 404.

---

### POST /ai/generate-demand/{case_id}

Generate a demand letter for a case using Claude. Auto-pulls: case + client + all medical providers (name, lien_amount, request_status) + case_costs + settlement_offer history + AI medical summaries. Produces structured demand with provider lien table, specials total, and demand amount.

**Response:**
```json
{
  "case_id": "uuid",
  "demand_id": "uuid",
  "content": "string",
  "status": "draft"
}
```

---

### GET /ai/demand/{case_id}

Retrieve the demand letter for a case.

**Response:** Stored `demand_letters` row or 404.

---

### PATCH /ai/demand/{case_id}

Update demand letter content or status.

**Body:**
```json
{ "content": "string", "status": "draft|final|sent" }
```

---

### POST /ai/intake-summary

Generate an AI intake summary for a lead.

**Body:**
```json
{ "lead_id": "uuid" }
```

**Response:**
```json
{
  "lead_id": "uuid",
  "summary": "string",
  "recommended_status": "string"
}
```

---

### POST /ai/score-lead

Score a lead 0–100 using Claude. Called by n8n `lead-scoring` workflow after lead creation.

**Body:**
```json
{ "lead_id": "uuid" }
```

**Response:**
```json
{
  "lead_id": "uuid",
  "score": 82,
  "reason": "string"
}
```

**Side effect:** PATCHes `leads.lead_score` and `leads.lead_score_reason` in DB.

---

### POST /ai/embed-case

Embed a case's text summary (facts + client + providers + settlement) for similarity search. Stores embedding in `case_embeddings`.

**Body:**
```json
{ "case_id": "uuid" }
```

**Response:**
```json
{ "case_id": "uuid", "stored": true }
```

---

### GET /ai/similar-cases/{case_id}

Find top 3 most similar closed cases by cosine similarity on `case_embeddings`.

**Response:**
```json
{
  "case_id": "uuid",
  "similar": [
    {
      "case_id": "uuid",
      "case_number": "string",
      "injury_type": "string",
      "gross_settlement": 85000,
      "similarity": 0.92
    }
  ]
}
```

---

### POST /ai/embed-document

Chunk and embed an uploaded document for RAG search. Accepts staff JWT or `X-Internal-Key` header (for fire-and-forget from files service).

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| document_id | uuid | Document to embed |

**Body:** none (query param only)

**Response:**
```json
{ "document_id": "uuid", "chunks_stored": 12 }
```

**Notes:** Uses word-based chunking (~500 words, 50-word overlap). Embeddings via OpenRouter `text-embedding-3-small` or `[0.1]*1536` stub when `OPENROUTER_API_KEY` unset.

---

### POST /ai/search-documents

Semantic search across document chunks for a case. Requires staff JWT.

**Body:**
```json
{
  "query": "string",
  "case_id": "uuid",
  "limit": 5
}
```

**Response:**
```json
{
  "query": "string",
  "results": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "file_name": "string",
      "content": "string",
      "similarity": 0.87,
      "chunk_index": 3
    }
  ]
}
```

---

## OpenClaw Gateway (`/openclaw`)

WebSocket-based AI agent gateway. Not a REST API — uses OpenClaw protocol.

| Endpoint | Description |
|----------|-------------|
| `GET /openclaw/healthz` | Health check — returns `{"ok": true}` |
| `GET /openclaw/` | Control UI (embedded as iframe in React SPA) |
| `ws://<host>/openclaw` | WebSocket — agent session endpoint |

**Auth:** Hash fragment `#gatewayUrl=ws://...&token=<OPENCLAW_GATEWAY_TOKEN>` passed by frontend.

**Agent:** Wyatt (`id: wyatt`, `model: openrouter/auto`). Identity injected from `/workspace/SOUL.md`, `/workspace/IDENTITY.md`, `/workspace/USER.md`.

**MCP Tools (Wyatt DB access):**

`tools/postgrest-mcp.js` — Node.js MCP server over stdin/stdout (JSON-RPC 2.0). Started as child process by OpenClaw when registered in `openclaw.json`.

| Tool | Description | PostgREST call |
|------|-------------|----------------|
| `get_leads` | List leads (optional status filter) | `GET /api/leads` |
| `get_lead` | Single lead by UUID | `GET /api/leads?id=eq.<id>` |
| `get_cases` | List cases (optional status filter) | `GET /api/cases` |
| `get_case` | Single case by UUID | `GET /api/cases?id=eq.<id>` |
| `get_communications` | Lead communication timeline | `GET /api/communications?lead_id=eq.<id>` |
| `get_analytics_summary` | Lead + case counts | `GET /api/lead_funnel_stats` + `GET /api/case_stage_stats` |

All MCP tool calls generate a short-lived HS256 JWT internally using `JWT_SECRET` env var.
