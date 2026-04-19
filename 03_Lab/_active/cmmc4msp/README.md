# CMMC Compliance OS — cmmc4msp

> Multi-tenant SaaS platform for MSPs to manage CMMC Level 2 compliance across defense contractor clients.

**Stack:** Next.js 14 · FastAPI · PostgreSQL · Hasura · n8n · MinIO · Authentik · Traefik  
**Deploy:** Single Ubuntu 24.04 VM · Docker Compose  
**VM:** `10.10.110.41` (ssh alias: `cmmc4msp`)

---

## Status (2026-04-19)

| Layer | Status | Notes |
|-------|--------|-------|
| Infrastructure | Live | All 8 containers healthy, log rotation applied |
| FastAPI | Live | 13 routers, JWT auth, SPRS calc, static harvester mount |
| Hasura | Live | 16 tables tracked, 0 inconsistencies |
| PostgreSQL | Live | 27 migrations, 110 controls + 297 objectives seeded |
| MinIO | Live | 4 buckets: artifacts, reports, drafts, exports |
| n8n | Live | 16 workflows active (incl. freshness, drift, triage, integrations) |
| Next.js | Live | 15+ pages, Authentik OIDC, role-aware sidebar |
| Authentik | Live | OIDC configured, CMMC scope mapping deployed |
| E2E Pipeline | Working | Upload → extract → Claude → assessed → SPRS updated |

---

## Service URLs

| Service | URL | Auth |
|---------|-----|------|
| App | https://app.cmmc4msp.on-nex.us | Authentik SSO |
| API | https://api.cmmc4msp.on-nex.us | JWT (Authentik) |
| GraphQL | https://gql.cmmc4msp.on-nex.us | Hasura admin secret |
| n8n | https://n8n.cmmc4msp.on-nex.us | See .env |
| MinIO | https://minio.cmmc4msp.on-nex.us | See .env |
| Harvester scripts | https://api.cmmc4msp.on-nex.us/harvester/ | Public (PS1/SH download) |

---

## Engagement Role Hierarchy

```
0  — Platform Owner (Onnex / super_admin)     → /platform
0.1 — MSP admin (e.g. AirGap Cyber)           → /msp
1.0 — Client Org (e.g. Meridian Defense)      (no login)
1.1 — Client admin (John @ Meridian)          → /[orgSlug]/*
1.2 — Team members (Jane, Bob, Alice)         → /[orgSlug]/tasks (restricted)
```

Full creation flow + step-by-step actions: `context/engagement-roles-and-flow.md`

---

## Architecture

```
INTERNET → Traefik (TLS) → Next.js | FastAPI | Hasura | Authentik
                                         ↓
                          PostgreSQL · Redis · MinIO · n8n (queue mode)
                                         ↓
                          Anthropic API · OpenRouter · Resend · 6 integrations
```

Multi-tenancy: `super_admin` → `msp_admin` → `client_admin` / `client_user`  
Auth: Authentik OIDC → JWT `{role, org_id, msp_id}` → Hasura row-level permissions + FastAPI guards

---

## Core Workflow: Artifact Assessment (n8n Workflow 02)

1. Client uploads artifact → FastAPI `/api/artifacts/{pc_id}/upload`
2. FastAPI stores in MinIO + fires n8n webhook
3. n8n extracts text → FastAPI `/api/artifacts/extract`
4. n8n builds Claude prompt with control requirement + acceptable proof guidance
5. n8n calls OpenRouter (claude-sonnet) → structured JSON verdict
6. n8n stores assessment + updates `artifact.assessment_status = 'assessed'`
7. SPRS recalculates via trigger → Workflow 03
8. Phase unlock check → Workflow 04 if warranted

---

## Evidence Automation (Quick Wins Hub — `/evidence-automation`)

Five pathways to reduce manual evidence collection:

| Pathway | What it does | API |
|---------|-------------|-----|
| **Integrations** | Connect Entra ID / Okta / Defender / CrowdStrike / M365 / Splunk; nightly auto-sync | `POST /api/integrations/{id}/sync` |
| **Bulk Evidence Request** | Select controls → assign to team member → email blast with due dates | `POST /api/assignments/bulk` |
| **AI Interview → Evidence** | Chat with copilot per control → "Save as Evidence" creates artifact + triggers assessment | `POST /api/controls/program/{pid}/{cid}/finalize-interview` |
| **Harvester (Windows)** | Download `harvest_windows.ps1` → runs 12 collectors → uploads ZIP | `POST /api/artifacts/bulk-upload-zip` |
| **Harvester (Linux)** | Download `harvest_linux.sh` → runs 11 collectors → uploads ZIP | Same endpoint |

Harvester scripts: `scripts/harvest_windows.ps1` · `scripts/harvest_linux.sh` · `scripts/README_HARVESTER.md`

---

## Repository Structure

```
cmmc4msp/
├── fastapi/
│   ├── app/
│   │   ├── routers/          13 API routers (controls, artifacts, assignments,
│   │   │                     integrations, invites, msps, orgs, programs,
│   │   │                     assessments, reports, audit, analytics, triage,
│   │   │                     ssp_interview, notifications, webhooks, client_errors)
│   │   ├── services/         minio, n8n, sprs, extraction, integration, report,
│   │   │                     copilot, gap_analysis, sweep, drift, freshness, email
│   │   ├── middleware/        correlation ID, access log, exception handlers
│   │   └── deps.py           4-tier RBAC guards
│   ├── static/harvester/     PS1 + SH scripts (served at /harvester/*)
│   └── tests/                385 pytest tests, 39 test files
├── nextjs/src/
│   ├── app/
│   │   ├── [orgSlug]/        dashboard, controls, controls/[id], tasks, team,
│   │   │                     artifacts, integrations, evidence-automation, poam,
│   │   │                     reports
│   │   ├── platform/         super_admin hub (msps, clients, health, analytics)
│   │   └── msp/              MSP portfolio (clients, analytics, team, reports)
│   ├── components/           AppSidebar, CopilotChat, DomainHeatmap,
│   │                         PhaseProgress, ControlStatusBadge, ...
│   └── graphql/queries.ts    All GQL queries (21 named queries)
├── n8n/workflows/            16 workflow JSON definitions
├── postgres/migrations/      001–027 SQL migrations
├── scripts/                  Deployment, fix scripts, harvesters, seeder
├── context/                  TELOS + strategy + engagement flow + current-data
└── plans/                    Implementation plans + IMPLEMENTATION-TRACKER.md
```

---

## Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| `akadmin` / `hugh@on-nex.com` | super_admin | See .env |
| `admin@meridian-defense.demo` | client_admin (Meridian Defense) | `DemoAdmin2026!` |
| `engineer@meridian-defense.demo` | client_user | `DemoUser2026!` |
| `auditor@meridian-defense.demo` | client_user | `DemoUser2026!` |

Demo org: `meridian-defense` (org_id: `a10d9db5-be5e-5f72-bb8e-04cdc3dc1e00`)

---

## Key n8n Production Gotchas

**HTTP Request typeVersion 1 uses `requestMethod` not `method`**  
Patching nodes via DB: use `requestMethod: "POST"`. The `method` key is silently ignored.

**Postgres executeQuery needs RETURNING on DML**  
Without RETURNING, INSERT/UPDATE returns [] and breaks the execution chain.

**`$env` access requires `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`**  
n8n 2.x blocks env var access in expressions by default.

**Authentik JWT `sub` claim for demo users is integer pk string (e.g. `"9"`)** — not a UUID.  
`_resolve_db_user_id()` in `controls.py` handles this: lookup by email → UUID parse → uuid5 fallback + upsert.

**`docker compose restart` does NOT rebuild the image.**  
Always deploy FastAPI changes with: `docker compose build fastapi && docker compose up -d fastapi`

---

## Common Commands (SSH to VM: `ssh cmmc4msp`)

```bash
# Deploy FastAPI changes (build + restart)
cd /opt/stacks/cmmc4msp
docker compose build fastapi && docker compose up -d fastapi

# View logs
docker logs cmmc-fastapi --tail 50 -f
docker logs cmmc-n8n --tail 50

# Run tests
docker exec cmmc-fastapi pytest -q
docker exec cmmc-fastapi pytest tests/test_integrations_router.py -v

# DB: check controls seeded
docker exec cmmc-postgres psql -U cmmc_user -d cmmc_main \
  -c "SELECT COUNT(*) FROM control_definitions"

# Apply migration
docker exec -i cmmc-postgres psql -U cmmc_user -d cmmc_main \
  < postgres/migrations/027_integration_instance_url.sql

# Health check
curl https://api.cmmc4msp.on-nex.us/health
curl https://api.cmmc4msp.on-nex.us/health/deep
```

---

## Full Documentation

- **Product Guide + Feature Reference:** `outputs/CMMC4MSP-Product-Guide.md`
- **Engagement Roles & Flow:** `context/engagement-roles-and-flow.md`
- **Implementation Tracker:** `plans/IMPLEMENTATION-TRACKER.md`
- **Current Metrics:** `context/current-data.md`
- **Original Spec:** `files/initialProjectDescriptiom.md`
