# Phase 1 — Revenue Protection: Plan

**Created:** 2026-03-16
**Status:** Ready
**Milestone:** v1.0

---

## Scope

Build the Revenue Protection module — the demo-ready sales wedge. Delivers multi-tenant lead capture, speed-to-lead automation (< 2 min SMS), missed call recovery, intake/retainer follow-up sequences, unified lead timeline, and a KPI dashboard showing response time + recovery rate. Deployed on Docker Compose to 10.10.110.33.

---

## Repo Structure

All application code lives in `projects/pi-lawyer-os/`:

```
projects/pi-lawyer-os/
├── docker-compose.yml         # all 6 services wired together
├── docker-compose.override.yml # local dev overrides
├── .env.example               # all required env vars documented
├── .gitignore
├── .gitlab-ci.yml             # CI/CD pipeline
├── README.md
├── traefik/
│   ├── traefik.yml            # static config
│   └── dynamic/
│       └── routes.yml         # service routing rules
├── postgres/
│   └── init.sql               # full Phase 1 schema
├── auth/
│   ├── Dockerfile
│   ├── main.py                # JWT issue/verify — minimal FastAPI
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf             # serve Vite build
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── components.json        # shadcn config
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes.tsx
│       ├── types/             # shared TypeScript interfaces
│       ├── hooks/             # TanStack Query hooks
│       ├── lib/               # utilities (api client, jwt, etc.)
│       ├── components/
│       │   ├── ui/            # shadcn components
│       │   └── layout/        # Sidebar, Header, AppShell
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx
│           ├── Leads.tsx
│           └── LeadDetail.tsx
└── n8n/
    └── workflows/             # import-ready n8n JSON files
        ├── speed-to-lead.json
        ├── missed-call-recovery.json
        ├── intake-reminder.json
        └── retainer-followup.json
```

---

## Waves

### Wave 1: Repo Scaffold
**Goal:** Working directory structure + all config files so every subsequent task has its home.
**All tasks parallel.**

| Task | Description | Output Files |
|------|-------------|--------------|
| 1.1 | Create `docker-compose.yml` with all 6 services: traefik, frontend, postgres, postgrest, n8n, neo4j, auth | `docker-compose.yml` |
| 1.2 | Create `.env.example` with all required env vars documented | `.env.example` |
| 1.3 | Create `traefik/traefik.yml` and `traefik/dynamic/routes.yml` | `traefik/` |
| 1.4 | Create `postgres/init.sql` — full Phase 1 schema (from `reference/db-schema.sql`) + PostgREST roles/grants | `postgres/init.sql` |
| 1.5 | Create `.gitignore` and `README.md` skeleton | `.gitignore`, `README.md` |
| 1.6 | Create `.gitlab-ci.yml` — build + SSH deploy to 10.10.110.33 | `.gitlab-ci.yml` |

---

### Wave 2: Auth Service + PostgREST Config
**Goal:** JWT auth working end-to-end — login returns token, PostgREST validates it.
**Depends on:** Wave 1 complete.
**Tasks 2.1 and 2.2 are parallel.**

| Task | Description | Output Files |
|------|-------------|--------------|
| 2.1 | Build minimal auth service: `POST /login` (email+password → JWT with firm_id + role claims), `GET /me`. Python FastAPI, ~80 lines. | `auth/main.py`, `auth/Dockerfile`, `auth/requirements.txt` |
| 2.2 | Configure PostgREST: `postgrest.conf` with DB URI, JWT secret, schema = `public`, anon role. Add `db_pre_config` function in init.sql for row-level security. | `postgres/init.sql` (update), `postgrest.conf` |
| 2.3 | Verify auth end-to-end: login → JWT → PostgREST request with Bearer token returns firm-scoped rows only. | (test only, no new files) |

---

### Wave 3: Frontend Foundation
**Goal:** React app scaffold with routing, layout, auth flow, and API client wired to PostgREST.
**Depends on:** Wave 1 (directory exists). Can run in parallel with Wave 2.
**Tasks 3.1–3.4 are parallel.**

| Task | Description | Output Files |
|------|-------------|--------------|
| 3.1 | Scaffold Vite + React 18 + TypeScript project. Install: tailwindcss, shadcn/ui, framer-motion, @tanstack/react-query, react-hook-form, zod, recharts, react-router-dom | `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/components.json` |
| 3.2 | Build `AppShell` layout: sidebar nav (Dashboard, Leads, Settings), header with firm name + user menu. shadcn/ui base. | `frontend/src/components/layout/` |
| 3.3 | Build auth flow: `Login.tsx` page (email/password form → POST /auth/login), JWT stored in localStorage, `useAuth()` hook, protected route wrapper. | `frontend/src/pages/Login.tsx`, `frontend/src/hooks/useAuth.ts`, `frontend/src/lib/auth.ts` |
| 3.4 | Set up API client: TanStack Query provider, PostgREST base URL from env, `useApi()` hook that injects Authorization header. Type: `Lead`, `Communication`, `Firm` interfaces. | `frontend/src/lib/api.ts`, `frontend/src/hooks/useApi.ts`, `frontend/src/types/index.ts` |

---

### Wave 4: Lead Ingestion
**Goal:** Leads can be created from web form and via Twilio inbound; lead list and detail are visible in UI.
**Depends on:** Wave 2 (PostgREST auth working), Wave 3 (frontend scaffold ready).
**Tasks 4.1–4.3 are parallel. Task 4.4 depends on 4.1.**

| Task | Description | Output Files |
|------|-------------|--------------|
| 4.1 | Build `LeadIntakeForm` component: fields = first name, last name, phone, email, injury type (select), source (hidden = `web-form`). Submit → `POST /leads` via PostgREST. Zod validation. | `frontend/src/components/LeadIntakeForm.tsx` |
| 4.2 | Build `Leads.tsx` page: lead list with columns (name, phone, injury type, status badge, created date, response time). TanStack Query. Filter by status. | `frontend/src/pages/Leads.tsx`, `frontend/src/hooks/useLeads.ts` |
| 4.3 | Build Twilio inbound webhook receiver n8n workflow: `POST /n8n/webhook/twilio-inbound` → parse Twilio form data → create lead in Postgres via PostgREST (source = `phone`). | `n8n/workflows/twilio-inbound.json` |
| 4.4 | Build `LeadDetail.tsx` page: lead info card, status change dropdown, manual note entry (creates `communication` record with channel = `note`). | `frontend/src/pages/LeadDetail.tsx`, `frontend/src/hooks/useLead.ts` |

---

### Wave 5: n8n Workflows
**Goal:** All 4 automation workflows deployed and functional in n8n.
**Depends on:** Wave 2 (n8n running, PostgREST accessible).
**All tasks parallel — independent workflows.**

| Task | Description | Output Files |
|------|-------------|--------------|
| 5.1 | Speed-to-lead workflow: webhook trigger on lead insert → Twilio SMS within 2 min → log to communications table. Adapt from `reference/n8n-workflows/speed-to-lead.json`. Add Postgres notification trigger in `init.sql`. | `n8n/workflows/speed-to-lead.json`, `postgres/init.sql` (trigger update) |
| 5.2 | Missed call recovery workflow: Twilio missed-call webhook → immediate SMS → wait 2h → check lead status → follow-up SMS if still `new`. Adapt from `reference/n8n-workflows/missed-call-recovery.json`. | `n8n/workflows/missed-call-recovery.json` |
| 5.3 | Intake completion reminder: cron every hour → query leads with status `intake-in-progress` AND updated_at > 24h ago AND reminder_count < 3 → SMS each → increment reminder counter. | `n8n/workflows/intake-reminder.json`, `postgres/init.sql` (add `reminder_count` column to leads) |
| 5.4 | Retainer follow-up sequence: cron daily → query leads with status `contacted` AND updated_at > 48h → send SMS based on days elapsed (Day 2 / Day 5 / Day 10 messages) → stop when status = `signed` or `lost`. | `n8n/workflows/retainer-followup.json` |

---

### Wave 6: Lead Timeline + Dashboard
**Goal:** Unified lead timeline visible in UI; KPI dashboard with real data.
**Depends on:** Wave 4 (leads exist), Wave 5 (communications being logged by n8n).
**Tasks 6.1 and 6.2 are parallel.**

| Task | Description | Output Files |
|------|-------------|--------------|
| 6.1 | Build `LeadTimeline` component: chronological feed of all `communications` for a lead, grouped by date, with icons per channel (sms, call, note). Auto-refresh with TanStack Query. Integrate into `LeadDetail.tsx`. | `frontend/src/components/LeadTimeline.tsx` |
| 6.2 | Build `Dashboard.tsx` page with 4 KPI cards: (1) avg speed-to-lead response time in minutes — SQL: avg(first_communication.created_at - lead.created_at) where channel=sms, direction=outbound; (2) missed call recovery rate — count(recovered)/count(missed_calls); (3) leads by status — donut chart via Recharts; (4) intake completion rate. Also: lead list table with sortable columns. | `frontend/src/pages/Dashboard.tsx`, `frontend/src/hooks/useDashboardStats.ts` |

**Note on KPI queries:** PostgREST doesn't support aggregation directly. Two options:
- Option A: Create Postgres views for each KPI → expose via PostgREST (`GET /kpi_response_time`)
- Option B: Add a minimal stats endpoint to the auth service

**Decision: Use Postgres views (Option A).** Add to `postgres/init.sql`:
- `CREATE VIEW kpi_response_time AS ...`
- `CREATE VIEW kpi_recovery_rate AS ...`
- `CREATE VIEW kpi_leads_by_status AS ...`

| Task | Description | Output Files |
|------|-------------|--------------|
| 6.3 | Write Postgres KPI views and grant SELECT to `web_anon` role. | `postgres/init.sql` (views section) |

---

### Wave 7: Deploy + Smoke Test
**Goal:** Stack running on 10.10.110.33, all success criteria verified.
**Depends on:** All previous waves complete.

| Task | Description | Output Files |
|------|-------------|--------------|
| 7.1 | Copy `.env.example` → `.env` on server, fill real values (Twilio credentials, JWT secret, Postgres password). Never committed. | Server only |
| 7.2 | Deploy to 10.10.110.33: `git pull` + `docker compose pull` + `docker compose up -d`. Verify all 7 services healthy. | — |
| 7.3 | Import n8n workflows from `n8n/workflows/` into running n8n instance. Configure Twilio credentials in n8n. Activate all 4 workflows. | — |
| 7.4 | Smoke test: (1) submit lead via intake form → verify SMS received within 2 min; (2) simulate missed call → verify immediate SMS; (3) verify lead appears in UI with timeline; (4) verify dashboard KPIs update. | — |

---

## Success Criteria

From ROADMAP.md Phase 1:

- [ ] Docker Compose stack healthy: traefik, frontend, postgres, postgrest, n8n, neo4j, auth (7 services)
- [ ] Core schema deployed: firms, leads, communications, users + pgvector + indexes
- [ ] Lead ingestion working: web form creates lead + Twilio inbound webhook creates lead
- [ ] Speed-to-lead: SMS sent within 2 min of lead creation (n8n workflow active)
- [ ] Missed call recovery: SMS → 2h wait → follow-up SMS (n8n workflow active)
- [ ] Intake completion reminders running (n8n scheduled workflow)
- [ ] Retainer follow-up sequences running (n8n scheduled workflow)
- [ ] Unified lead timeline visible in UI
- [ ] Response time dashboard live with 4 KPI cards
- [ ] JWT auth working with firm_id scoping
- [ ] CI/CD auto-deploys to 10.10.110.33 on push to main

---

## Technical Specifics

### Docker Service Names
| Service | Image | Internal Port |
|---------|-------|--------------|
| `traefik` | traefik:v3 | 80, 443 |
| `frontend` | custom/nginx | 80 |
| `postgres` | postgres:15 | 5432 |
| `postgrest` | postgrest/postgrest:latest | 3000 |
| `n8n` | n8nio/n8n:latest | 5678 |
| `neo4j` | neo4j:5 | 7474, 7687 |
| `auth` | custom/python | 8000 |

### Required Env Vars (.env)
```
# Postgres
POSTGRES_DB=pilaweros
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong_password>

# PostgREST
PGRST_DB_URI=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/pilaweros
PGRST_DB_SCHEMA=public
PGRST_DB_ANON_ROLE=web_anon
PGRST_JWT_SECRET=<32+ char secret>

# Auth service
JWT_SECRET=<same as PGRST_JWT_SECRET>
AUTH_DB_URI=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/pilaweros

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<password>
N8N_WEBHOOK_URL=https://n8n.pilaweros.local

# Neo4j
NEO4J_AUTH=neo4j/<password>
```

### Traefik Routing
| Path | Service | Notes |
|------|---------|-------|
| `/*` | frontend | SPA catch-all |
| `/api/*` | postgrest | Strip `/api` prefix |
| `/auth/*` | auth | JWT service |
| `/n8n/*` | n8n | Workflow UI + webhooks |

### PostgREST Roles
```sql
-- Created in postgres/init.sql
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '...';
GRANT web_anon TO authenticator;

-- Row-level security: PostgREST reads firm_id from JWT
-- All SELECT/INSERT/UPDATE/DELETE filtered by firm_id claim
```

### Frontend File Conventions
- Files: kebab-case (`lead-detail.tsx`, `use-leads.ts`)
- Components: PascalCase (`LeadDetail`, `LeadTimeline`)
- Hooks: `use` prefix (`useLeads`, `useDashboardStats`)
- Pages in `src/pages/` — one file per route
- Shared types in `src/types/index.ts`
- `firm_id` always from `useFirm()` hook — never hardcoded
- All API calls through TanStack Query hooks in `src/hooks/`

### Key Commands
```bash
# Start stack locally
docker compose up -d

# View logs
docker compose logs -f [service]

# Restart single service
docker compose restart [service]

# Apply schema changes (destroy + recreate for dev)
docker compose down -v && docker compose up -d postgres
docker compose exec postgres psql -U postgres -f /docker-entrypoint-initdb.d/init.sql

# SSH to server
ssh root@10.10.110.33

# Deploy to server
ssh root@10.10.110.33 "cd /opt/pi-lawyer-os && git pull && docker compose up -d --build"
```

---

## Deferred (Out of Phase 1 Scope)

- Case management UI (Phase 2)
- SOL tracking (Phase 2)
- Medical records (Phase 2)
- Document upload (Phase 2+)
- Claude API integration (Phase 3)
- Revenue growth automations (Phase 4)
- Settlement/billing (Phase 5)
- Client portal (Phase 6)
- Authentik SSO (v2)
- Mobile-responsive UI (desktop-first for Phase 1)
- Multi-region or multi-VM orchestration
- Neo4j queries in UI (Neo4j synced in Phase 1, queried in Phase 4)
