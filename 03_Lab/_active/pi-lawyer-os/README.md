# PI Lawyer OS

AI-native operating system for Personal Injury law firms (5–20 attorney practices). Replaces scattered case management tools, Excel, and email chains with a unified AI-assisted platform. Built and deployed by Onnex AI.

## What It Is

PI Lawyer OS covers the full lifecycle of a PI practice: lead intake through settlement disbursement. Every module is AI-assisted — from speed-to-lead SMS within 2 minutes, to Claude-powered demand letter generation, to Wyatt (the firm's AI operations assistant) with live database access.

Deployed as a per-client Docker Compose stack on a dedicated VM. White-label branding per firm.

---

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env
# Edit .env with real values (see Environment Variables below)

# 2. Start stack
docker compose up -d

# 3. Verify all services healthy
docker compose ps

# 4. Import n8n workflows
# Open https://<domain>/n8n → Workflows → Import from file
# Import each file from n8n-workflows/

# 5. Open app
# https://<domain>
# Default admin: admin@demo.pilaweros.local / Admin1234!
```

---

## Full Feature Set — 12 Complete Phases

### Phase 1 — Revenue Protection Foundation
- Speed-to-lead: SMS within 2 minutes of lead creation (n8n)
- Missed call recovery: automated follow-up sequence
- Intake completion reminders + retainer follow-up automations
- Unified lead timeline with communication log
- KPI dashboard: response time, recovery rate, lead counts

### Phase 2 — Case Management Core
- Case create from signed lead
- Case list + detail with full timeline
- SOL tracking + 90/60/30 day alerts
- Medical records tracker per case (provider, status, lien amount)
- Task + deadline management
- Document upload + tagging
- Specials total calculation

### Phase 3 — Document AI
- Medical record upload → Claude extracts injuries, treatment, specials
- Medical summary card per provider
- Demand letter draft generation (Claude API)
- Document auto-classification on upload
- AI intake summary from notes/transcript

### Phase 4 — Revenue Growth
- Lost lead resurrection sequences (n8n — 35/50 day triggers)
- Partner referral tracking with commission management
- Review-to-case conversion monitoring
- Referral flywheel with partner performance dashboard

### Phase 5 — Settlement + Billing
- Settlement offer/counter tracker (full negotiation chain)
- Disbursement calculator (gross → fee → costs → client net)
- Fee ledger with cost type breakdown
- Case costs tracking (medical liens, filing fees, expert fees)

### Phase 6 — Client Portal + Analytics
- External client portal: case status + document access
- Analytics dashboard: case values, settlement rates, referral attribution
- Source attribution tracking (Google, referral, web-form, billboard)
- Attorney performance view

### Phase 7 — Automation Activation
- All 6 n8n workflows live: speed-to-lead, missed call, resurrection, referral thank-you, intake reminder, retainer follow-up
- TWILIO_TEST_MODE for safe activation without real SMS
- Stub communications log for E2E verification

### Phase 8 — Lead Intelligence
- pgvector lead scoring (0–100, auto-updated every 5 min via n8n)
- Duplicate detection with lead dedup banner
- Similar cases semantic search on case detail
- Case embeddings for RAG

### Phase 9 — Growth Channels
- Public web intake form at `/intake` (3-step, mobile-optimized)
- After-hours IVR workflow (n8n + Twilio)
- Google My Business review monitoring workflow
- Source attribution stats view

### Phase 10 — Multilingual + Firm Ops
- Spanish i18n (EN/ES toggle in Settings, reloads immediately)
- Staff user management: create/deactivate from Settings
- Audit log: INSERT/UPDATE/DELETE triggers on leads + cases
- AuditLogPanel on lead and case detail pages
- Attorney performance table on Analytics

### Phase 11 — Advanced AI
- Document RAG: pgvector embeddings, semantic search on case documents
- Wyatt DB MCP tools: PostgREST read/write via natural language
- Objection Library (20 seeded entries, editable in Settings)
- Enhanced demand letter (pulls provider/costs/offers data)
- Document chunk storage and fire-and-forget embed on upload

### Phase 12 — Platform Scale
- White-label firm branding: logo, primary color, SMS signature
- Sidebar dynamically uses firm logo and primary color
- SMTP configuration per firm (Settings)
- Document Templates (3 seeded: retainer, engagement letter, LOI)
- Stripe schema: subscription columns on firms table

---

## Services

| Service | URL | Container | Notes |
|---------|-----|-----------|-------|
| App | `/` | `frontend` | React SPA (port 3000) |
| API | `/api` | `postgrest` | PostgREST (port 3001) |
| Auth | `/auth` | `pilaweros-auth` | JWT service (port 8000) |
| AI | `/ai` | `pilaweros-ai` | Claude endpoints (port 8001) |
| n8n | `/n8n` | `n8n` | Workflow UI (port 5678) |
| Wyatt (AI) | `/openclaw/` | `openclaw` | OpenClaw gateway (port 47823) |
| Postgres | internal | `postgres` | Port 5432 (not exposed) |
| Neo4j | internal | `neo4j` | Port 7474 (not exposed) |
| Traefik | `:80` | `traefik` | Reverse proxy + routing |

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| API | PostgreSQL 15 + PostgREST + pgvector |
| Automation | n8n (self-hosted) |
| Comms | Twilio (SMS + voice) |
| Graph | Neo4j |
| Auth | JWT (custom service) |
| AI | Claude API (claude-sonnet-4-6) via OpenRouter |
| Proxy | Traefik v3 |
| AI Agent | OpenClaw (Wyatt) |

---

## Demo Data

See [docs/DEMO-DATA.md](docs/DEMO-DATA.md) for full details.

**Quick start:** Settings → Generate Demo Data

Generates: 5 partners · 12 leads · 5 cases (all statuses) · 19 documents · 1 demand letter · 2 settlements · portal account

Portal login: `portal@williams.demo` / `Portal2026!`

---

## Testing

See [docs/TESTING.md](docs/TESTING.md) for full E2E guide.

```bash
cd playwright-tests && npm test
```

14 test files, ~115 tests. Requires demo data to be generated first.

---

## Wyatt AI Agent

See [docs/WYATT.md](docs/WYATT.md) for architecture and usage.

- Navigate to **AI Agent** in sidebar or `/ai-agent`
- Wyatt has live PostgREST DB access via MCP tools
- LLM configurable via Settings → AI Assistant — LLM
- Health check: `GET /openclaw/healthz`

---

## Phase 13 — Production Readiness (In Progress)

Remaining operator infrastructure gaps:

| Item | Status |
|------|--------|
| Traefik n8n webhook strip-prefix fix | Complete ✅ |
| SMTP env vars in docker-compose | Complete ✅ |
| CI/CD pipeline rewrite (lint→test→deploy→health-check) | Complete ✅ |
| TLS / Let's Encrypt (requires real domain) | Planned |
| Stripe billing service integration | Planned |
| Email nodes in n8n workflows | Planned |

---

## Environment Variables

```env
# Database
POSTGRES_PASSWORD=...
PGRST_JWT_SECRET=...

# Auth
JWT_SECRET=...
INTERNAL_API_KEY=...

# AI
OPENROUTER_API_KEY=...
ANTHROPIC_API_KEY=...

# Wyatt / OpenClaw
OPENCLAW_GATEWAY_TOKEN=...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
TWILIO_TEST_MODE=true

# SMTP (Phase 12)
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

---

## Development

```bash
# Frontend dev server (hot reload)
cd frontend && npm install && npm run dev

# View service logs
docker compose logs -f [service]

# Restart a service
docker compose restart [service]

# Reset database (dev only — destroys data)
docker compose down -v && docker compose up -d
```

## Deployment

```bash
# Deploy to PI Lawyer OS server
ssh root@10.10.110.33 "cd /opt/pi-lawyer-os && git pull && docker compose up -d --build"
```
