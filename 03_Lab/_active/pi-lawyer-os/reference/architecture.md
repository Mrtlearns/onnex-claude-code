# PI Lawyer OS — Architecture

> Last updated: 2026-03-20
> Covers changes through: 0323e1a (Phase 12 — Platform Scale, v4.1 complete)

---

## Overview

Multi-tenant SaaS for Personal Injury law firms. Each client firm gets a dedicated Docker Compose instance on a dedicated VM. Shared codebase, per-client deployment. Covers intake, case management, document AI, settlement tracking, billing, analytics, client portal, AI-assisted operations via Wyatt, and white-label branding.

---

## Frontend

React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui. Served by nginx inside a Docker container. Auth is JWT stored in `localStorage`. Firm branding (logo, primary color, SMS signature) stored in `localStorage('firm')` at login and consumed by Sidebar + Settings. All API calls go through Traefik to PostgREST (`/api`) or auth service (`/auth`). Portal uses a separate JWT role (`client_user`). i18n (EN/ES) stored in `localStorage('language')` and driven by `I18nProvider`.

### Route Map

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/` | RootRedirect | — | Redirects to `/dashboard` or `/login` |
| `/login` | Login | — | Staff login |
| `/intake` | IntakeForm | — | Public multi-step intake form (no auth required) |
| `/dashboard` | Dashboard | staff | KPI cards, lead chart, SOL alerts, resurrection queue, referral stats |
| `/leads` | Leads | staff | Lead list with status/score filter |
| `/leads/:id` | LeadDetail | staff | Lead timeline, communications, status, score badge, duplicate banner, audit log |
| `/cases` | Cases | staff | Case list |
| `/cases/:id` | CaseDetail | staff | Case detail — tabs: Overview, Documents, Medical, Settlement, Tasks, Client Portal |
| `/partners` | Partners | staff | Referral partner list |
| `/partners/:id` | PartnerDetail | staff | Partner detail + referral history |
| `/analytics` | Analytics | staff | KPI tiles, lead funnel, partner performance, source attribution, attorney performance |
| `/ai-agent` | AIAgent | staff | Wyatt AI Agent — OpenClaw iframe |
| `/settings` | Settings | staff | Account info, LLM config, firm branding, objection library, document templates, SMTP, demo data |
| `/portal/login` | PortalLogin | — | Client portal login |
| `/portal` | ClientPortal | portal | Client's case status, documents, settlement info |

### Key Components

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Left nav — firm logo, primary color, all routes |
| `CaseDetail` | Tabbed case view (6 tabs) |
| `SettlementPanel` | Negotiation offer chain + disbursement calculator |
| `DemandLetterPanel` | AI-generated demand letter editor |
| `MedicalAiSummary` | AI summary of medical records per case |
| `DocumentPanel` | File upload, list, share-with-client toggle, semantic search |
| `TaskPanel` | Case tasks with status management |
| `MedicalProviderPanel` | Per-case medical provider/lien tracker |
| `PortalAccessPanel` | Create/manage client portal accounts |
| `AuditLogPanel` | Collapsible audit event timeline per lead/case |
| `SimilarCasesPanel` | Top 3 similar closed cases surfaced on CaseDetail Overview |
| `ResurrectionQueueWidget` | Dashboard widget — stale leads for re-engagement |
| `ReferralStatsWidget` | Dashboard widget — referral partner performance |
| `AIAgent` | Full-viewport iframe embedding OpenClaw, with token auth and model badge |
| `IntakeForm` | Public multi-step intake form (contact → injury → medical → submit) |

---

## Backend Services

### Auth Service (FastAPI — port 8000)

Custom JWT issuer, LLM config manager, and user management. Mounted at `/auth` via Traefik.

See `reference/API.md` for full endpoint reference.

### AI Service (FastAPI — port 8002)

Document analysis, demand letter generation, intake summarization, lead scoring, case embeddings, document RAG (chunk/embed/search), and similar case finder using Claude API (`claude-sonnet-4-6`) and OpenRouter embeddings (`text-embedding-3-small`). Mounted at `/ai/` via Traefik.

**Stub mode:** When `OPENROUTER_API_KEY` is unset or `=stub`, embeddings return `[0.1]*1536` deterministically. All vector math still works; similarity search returns results. Swap real key via `.env` with zero code changes.

### Files Service (FastAPI — port 8001)

Document upload/download with JWT auth. Stores files to a Docker volume. After successful upload, fires a background thread to `POST /ai/embed-document` (fire-and-forget; non-fatal on failure). Mounted at `/files` via Traefik.

### PostgREST (port 3000)

Auto-generated REST API from PostgreSQL schema. JWT-based row-level security — every query is automatically scoped to `firm_id` from JWT claims. Mounted at `/api` via Traefik. Must `docker compose restart postgrest` after schema migrations to invalidate schema cache.

---

## Database

PostgreSQL 15 (image: `pgvector/pgvector:pg15` — upgraded Phase 08 for vector support). RLS on all tables via `current_firm_id()` helper reading from JWT claims. Multi-tenant: every table has `firm_id UUID NOT NULL REFERENCES firms(id)`.

### Schema by Migration

| Migration | Tables / Changes | Notes |
|-----------|-----------------|-------|
| `init.sql` (Phase 1) | `firms`, `users`, `leads`, `communications`, `audit_log` | Base schema + RLS; audit_log triggers added Phase 10 |
| `002_case_management.sql` | `cases`, `clients`, `tasks`, `medical_providers`, `documents` | Case lifecycle |
| `003_document_ai.sql` | `ai_analyses`, `demand_letters` | AI result storage |
| `004_revenue_growth.sql` | `partners`, `partner_referrals` | Adds `last_contact_at`, `resurrection_sent_at`, `referred_by_partner_id` to `leads` |
| `005_billing_finance.sql` | `settlement_offers`, `case_costs`, `case_settlements` | Adds `attorney_fee_pct` to `cases`; computed columns on `case_settlements` |
| `006_portal_analytics.sql` | `client_users` | Portal login; `shared_with_client` on `documents`; `client_user` role; 4 analytics views |
| `007_grant_delete_web_user.sql` | — | Grants DELETE to `web_user` |
| `008_firm_settings.sql` | `firm_settings` | Per-firm LLM config (provider + model) |
| `009_lead_intelligence.sql` | `case_embeddings` | Adds `lead_score INT`, `lead_score_reason TEXT`, `is_duplicate BOOL`, `duplicate_of_lead_id UUID` to `leads`; `CREATE EXTENSION vector` |
| `010_growth_channels.sql` | — | Adds `date_of_loss DATE`, `fault TEXT`, `has_medical BOOL` to `leads`; `voicemail` channel; `source_attribution_stats` view |
| `011_multilingual.sql` | `audit_log` (triggers) | Adds `preferred_language TEXT` to `leads`+`clients`; `active BOOL` to `users`; PLPGSQL triggers on leads+cases for audit; `attorney_performance` view |
| `012_advanced_ai.sql` | `document_chunks`, `objection_library` | `document_chunks` stores RAG embeddings (`vector(1536)`); `objection_library` seeded with 20 PI intake objections |
| `013_platform_scale.sql` | `document_templates` | Adds `logo_url`, `primary_color`, `sms_signature`, `smtp_host/port/user/password`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` to `firms`; `document_templates` table seeded with 3 entries |

### Key Table Relationships

```
firms (+ logo_url, primary_color, sms_signature, smtp_*, stripe_*)
  ├── users (+ active)
  ├── leads (+ lead_score, is_duplicate, date_of_loss, fault, has_medical, preferred_language)
  │         → communications (timeline; channels: sms, email, voicemail, call)
  │         → partner_referrals → partners
  ├── cases → clients (+ preferred_language)
  │         → tasks
  │         → documents → ai_analyses
  │         │            → document_chunks (RAG embeddings, vector(1536))
  │         → medical_providers
  │         → settlement_offers
  │         → case_costs
  │         → case_settlements (1:1)
  │         → demand_letters (1:1)
  ├── partners → partner_referrals
  ├── client_users (portal login, links to clients)
  ├── firm_settings (LLM config, 1:1)
  ├── objection_library (PI intake FAQ + AI-approved responses)
  └── document_templates (retainer, engagement letter, LOI — Markdown with {{vars}})
```

### Analytics Views

| View | Migration | Description |
|------|-----------|-------------|
| `lead_funnel_stats` | 006 | Lead counts by status |
| `case_stage_stats` | 006 | Case counts by status |
| `partner_performance` | 006 | Referral counts + commission totals per partner |
| `monthly_intake` | 006 | Lead creation trend by month |
| `source_attribution_stats` | 010 | Lead counts + signed counts + conversion rate by source |
| `attorney_performance` | 011 | Cases/settlement/duration KPIs per attorney |

---

## Services (Docker Compose)

| Service | Container | Port | Image | Description |
|---------|-----------|------|-------|-------------|
| traefik | pilaweros-traefik | 80, 443 | traefik:v3 | Reverse proxy, TLS, routing |
| frontend | pilaweros-frontend | 80 (internal) | custom nginx | React 18 SPA |
| postgres | pilaweros-postgres | 5432 (internal) | pgvector/pgvector:pg15 | Primary data store + pgvector |
| postgrest | pilaweros-postgrest | 3000 (internal) | postgrest/postgrest | Auto-REST API |
| auth | pilaweros-auth | 8000 (internal) | custom FastAPI | JWT + LLM settings + user management |
| n8n | pilaweros-n8n | 5678 (internal) | n8nio/n8n | Workflow automation (9 workflows) |
| files | pilaweros-files | 8001 (internal) | custom FastAPI | Document upload/download + embed trigger |
| ai | pilaweros-ai | 8002 (internal) | custom FastAPI | Claude API wrapper + RAG + scoring |
| openclaw | pilaweros-openclaw | 47823 (internal) | ghcr.io/openclaw/openclaw | Wyatt AI agent gateway + MCP tools |
| neo4j | pilaweros-neo4j | internal only | neo4j:5 | Graph DB (reserved for future use) |

---

## Traefik Routing

| Path Prefix | Service | Notes |
|-------------|---------|-------|
| `/api` | postgrest | Strip `/api`, no TLS upstream |
| `/auth` | auth | Strip `/auth` |
| `/n8n` | n8n | No strip |
| `/files` | files | Strip `/files` |
| `/ai/` | ai | Strip `/ai` (trailing slash avoids colliding with `/ai-agent` SPA route) |
| `/openclaw` | openclaw | Strip `/openclaw`; `openclaw-headers@file` middleware overrides X-Frame-Options for iframe embedding |
| `*` (catch-all) | frontend | Excludes all above prefixes |

Dynamic config at `traefik/dynamic/routes.yml`. `openclaw-headers` middleware sets `X-Frame-Options: ""` and permissive `frame-ancestors 'self'` CSP.

---

## AI Stack

### Wyatt — OpenClaw AI Agent

- **Container:** `pilaweros-openclaw` (ghcr.io/openclaw/openclaw)
- **Config:** `openclaw/config/openclaw.json` — agent id `wyatt`, model `openrouter/auto`, fallback `anthropic/claude-sonnet-4-6`; includes `mcpServers.postgrest` pointing to `tools/postgrest-mcp.js`
- **Persona:** `openclaw/workspace/SOUL.md`, `IDENTITY.md`, `USER.md` — auto-injected by OpenClaw per session; `USER.md` includes objection-handling reference
- **MCP Tools:** `tools/postgrest-mcp.js` — Node.js MCP server (JSON-RPC 2.0 over stdin/stdout); exposes `get_leads`, `get_lead`, `get_cases`, `get_case`, `get_communications`, `get_analytics_summary`; uses HS256 JWT (crypto.createHmac) with `JWT_SECRET` env var
- **Auth:** token-based (`OPENCLAW_GATEWAY_TOKEN`); frontend fetches via `GET /auth/openclaw-token`

### LLM Settings

Stored in `firm_settings` table. Managed via `GET/PUT /auth/llm-settings`. The `PUT` endpoint also rewrites `openclaw/config/openclaw.json` via bind mount. Providers: OpenRouter (auto, gpt-4o, claude-sonnet, gemini-pro) and Anthropic direct. UI: Settings page → "AI Assistant — LLM" card.

### Claude API (Direct)

Used by the AI service for document analysis, demand letter generation (enhanced: auto-pulls providers/costs/offers), lead scoring, and intake summarization. Model: `claude-sonnet-4-6`.

### Document RAG

- Uploads trigger fire-and-forget `POST /ai/embed-document` via background thread
- Documents chunked by word (~500 words, 50-word overlap)
- Embeddings via OpenRouter `text-embedding-3-small` (stub: `[0.1]*1536` when key unset)
- Stored in `document_chunks` (pgvector `vector(1536)`)
- Search: `POST /ai/search-documents` — cosine similarity (`<=>` operator), returns top 5 chunks with document metadata

---

## Automation Stack

- **n8n** (self-hosted, `/n8n`) — workflow engine
- **Workflows (9 total):**
  1. `speed-to-lead.json` — lead created → immediate SMS within 2 min
  2. `missed-call-recovery.json` — Twilio missed call webhook → SMS callback
  3. `intake-reminder.json` — 48h cron for new/contacted leads → nudge SMS
  4. `retainer-followup.json` — signed lead, no document uploaded → SMS day 3/7
  5. `sol-alert.json` — SOL date approaching → staff alert
  6. `lost-lead-resurrection.json` — daily cron, leads inactive >30 days → SMS
  7. `referral-thankyou.json` — lead signed + partner linked → partner SMS
  8. `after-hours-ivr.json` — Twilio voice webhook (after hours) → voicemail + SMS
  9. `gmb-review-monitor.json` — daily GMB review fetch → auto-create lead from 4–5 star reviews
- **Twilio stub:** `TWILIO_TEST_MODE=true` (default) — all workflows log SMS to `communications` table instead of sending. Set `false` for real SMS with zero code changes.

---

## White-Label Branding

```
Login → auth service reads firms.logo_url, primary_color, sms_signature
      → LoginResponse.firm includes branding fields
      → Frontend onSuccess: localStorage.setItem('firm', JSON.stringify(firm))
      → useFirmBranding() hook reads from localStorage
      → Sidebar: uses primary_color for icon bg, shows logo_url image if set
      → Settings: Firm Branding card — logo URL, color picker, SMS sig, SMTP config
```

---

## Multi-Tenant Design

```
firms table → root tenant entity
  id (UUID, PK)
  name, slug (unique)
  logo_url, primary_color, sms_signature (branding)
  smtp_host/port/user/password (email config)
  stripe_customer_id, stripe_subscription_id, subscription_status

All tables: firm_id UUID NOT NULL REFERENCES firms(id)

PostgREST RLS:
  JWT contains firm_id claim
  Postgres function current_firm_id() reads from JWT
  All queries auto-filtered: WHERE firm_id = current_firm_id()

Portal JWT (client_user role):
  Additional client_id claim
  current_client_id() reads from JWT
  Client can only see their own case data

Audit log:
  PLPGSQL triggers on leads + cases (INSERT/UPDATE/DELETE)
  Writes to audit_log: entity_type, entity_id, action, actor_id, old/new values
```

---

## Deployment

```
Per-client instance:
  1 VM (Proxmox, ~4 vCPU, 8GB RAM, 100GB SSD)
  1 Docker Compose stack
  Traefik handles TLS + routing

Dev/Demo instance:
  10.10.110.33
  SSH: root / Poll0000
  Deploy dir: /opt/pi-lawyer-os/

Note: FastAPI services (ai, auth, files) bake source into Docker image.
  File changes require: docker compose build <service> && docker compose up -d <service>
  Restart alone is NOT sufficient for code changes.

E2E Tests:
  Playwright — playwright-tests/tests/
  Run: cd playwright-tests && npx playwright test
  Staff creds: admin@demo.pilaweros.local / Admin1234!
  Portal creds: portal@williams.demo / Portal2026! (firm: demo)
  Suite: 94/94 passing (Phase 1–12 complete)
```

---

## Data Flow — Document RAG Pipeline

```
1. Staff uploads document via DocumentPanel → POST /files/upload
2. Files service stores file, inserts row in documents table
3. Background thread fires POST /ai/embed-document (fire-and-forget, non-fatal)
4. AI service: fetches file from disk, reads content, chunks by word
5. AI service: calls OpenRouter text-embedding-3-small API (or returns stub vector)
6. AI service: stores chunks in document_chunks (document_id FK, chunk_index, content, embedding)
7. Staff enters query in DocumentPanel semantic search input
8. POST /ai/search-documents: embeds query → cosine similarity (<=>) → top 5 chunks
9. Frontend renders chunks with similarity % + document name + content preview
```

---

## Data Flow — Wyatt DB Tool (MCP)

```
1. Staff sends message to Wyatt in /ai-agent
2. OpenClaw decides to call MCP tool (e.g. get_leads)
3. OpenClaw spawns tools/postgrest-mcp.js as child process (stdin/stdout JSON-RPC 2.0)
4. MCP server generates HS256 JWT (JWT_SECRET env var) with web_user role + firm_id
5. MCP server calls PostgREST: GET /api/leads with Bearer JWT
6. PostgREST RLS: auto-scopes to firm_id from JWT
7. MCP server returns structured data to OpenClaw
8. OpenClaw includes data in Wyatt's context → response to staff
```

---

## Data Flow — Wyatt AI Agent Session

```
1. User navigates to /ai-agent in React SPA
2. Frontend fetches GET /auth/openclaw-token (requires staff JWT)
3. Auth service returns OPENCLAW_GATEWAY_TOKEN
4. Frontend builds iframe src: /openclaw/#gatewayUrl=ws://<host>/openclaw&token=TOKEN
5. OpenClaw UI loads in iframe, opens WebSocket to gateway
6. Gateway authenticates token, starts agent session with Wyatt identity
7. Wyatt reads SOUL.md + IDENTITY.md + USER.md from /workspace (bind mount)
8. User chats; Wyatt can call MCP tools for live DB data
9. Responses from OpenRouter/auto or Anthropic fallback
```

---

## Data Flow — Speed-to-Lead

```
1. Lead submits /intake form or calls inbound Twilio number
2. Lead record created in Postgres via POST /auth/intake (public) or PostgREST
3. n8n speed-to-lead webhook triggered
4. TWILIO_TEST_MODE=true → log to communications table (no real SMS)
5. TWILIO_TEST_MODE=false → Twilio Send SMS within 2 minutes
6. n8n logs communication row (channel: 'sms', direction: 'outbound')
```
