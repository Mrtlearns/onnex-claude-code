# Current Data

> Metrics, data points, and current state for CMMC Compliance OS.

---

## Key Metrics

| Metric | Current Value | Target | Notes |
| ------ | ------------- | ------ | ----- |
| Services deployed | 8/8 | 8 | All containers healthy on VM 10.10.110.41 |
| FastAPI routes implemented | 8/8 | 8 | All routers live; /onboard endpoint works end-to-end |
| n8n workflows imported | 8/8 | 8 | All 8 imported, visible via API, inactive (no Anthropic key yet) |
| Next.js pages | 9/9 | 9 | Built, Authentik OIDC wired, NEXT_PUBLIC_ vars set |
| DB migrations | 4/4 | 4 | Migration 004: msps table, msp_id FKs, super_admin/client_user roles applied |
| Controls seeded | 110/110 | 110 | 110 parents + 297 objectives = 407 total |
| Hasura metadata | 16/16 | 16 | All tables tracked, 0 inconsistencies |
| MinIO buckets | 4/4 | 4 | cmmc-artifacts, cmmc-reports, cmmc-backups, cmmc-exports created |
| n8n credentials | 3/4 | 4 | Postgres ✅, Anthropic (placeholder) ✅, SMTP (placeholder) ✅, Webhook secret pending |
| n8n workflow 02 | ✅ E2E working | Full pipeline: webhook → extract → Claude (openrouter/auto) → DB assessed |

## Current State — 2026-04-16

**All services live and healthy:**
- https://app.cmmc4msp.on-nex.us — Next.js ✅ (Authentik OIDC configured)
- https://api.cmmc4msp.on-nex.us/health — FastAPI ✅ (db: up)
- https://gql.cmmc4msp.on-nex.us/healthz — Hasura ✅
- https://n8n.cmmc4msp.on-nex.us — n8n ✅ (admin@cmmc4msp.on-nex.us / see .env)

**Authentik:** OIDC app `cmmc4msp` configured. CMMC scope mapping deployed (PK: `8ad285ab-eb95-400e-be35-a574cd283358`). Login emits `msp_id`/`org_id`/`role` + Hasura claims namespace. `akadmin` user set as `super_admin`.

**4-Tier RBAC (fully deployed 2026-04-16):**
- `super_admin` (Onnex) → unrestricted all tables, all MSPs, all orgs
- `msp_admin` → scoped to their MSP's orgs and programs only (Hasura + FastAPI enforced)
- `client_admin` / `client_user` → own org only
- Cross-tenant isolation tested: msp_admin_B cannot see msp_admin_A's orgs (403)
- Pytest: 43/43 passing

**Seeded test data:**
- MSP: Onnex (`slug=onnex`, `id=3e83d893-...`)
- MSP: Acme MSP (`slug=acme-msp`, `id=3a28b92b-...`)
- Org: Test Client A under Acme MSP (`id=d804cacf-...`)
- Program: Client A CMMC Program (`id=0ab4f265-...`)

**MinIO:** Service account `cmmc4msp-svc` created on TrueNAS MinIO. Buckets exist. ✅

**n8n:** 8 workflows imported, all active. Workflow 02 (Artifact Submitted) confirmed end-to-end: webhook → text extraction → Claude assessment (OpenRouter `openrouter/auto`) → DB stored with `assessment_status='assessed'`, `model_used='openrouter/auto'`. Known issue: "Trigger SPRS Recalculate" node (last step) returns 404 on internal webhook — non-critical since FastAPI assessment-complete handler already runs SPRS.

**n8n workflow fixes applied (2026-04-16):**
- v1 HTTP Request nodes use `requestMethod` not `method` — fixed via DB update scripts in `scripts/`
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` added to docker-compose for `$env.OPENROUTER_API_KEY` access
- All Postgres DML nodes have `RETURNING` clauses to keep execution chain alive
- FastAPI webhooks.py: fixed `control_status` enum, `event_type` column, `json.dumps()` for jsonb, body.secret auth fallback

## Pending (manual only — requires secrets you provide)

| Item | Status | Notes |
|------|--------|-------|
| ANTHROPIC_API_KEY | 🟡 OpenRouter used instead | Workflow 02 uses OpenRouter `openrouter/auto` (OPENROUTER_API_KEY set in docker-compose) |
| SMTP credentials | 🔴 Placeholder | Set SMTP_HOST/USER/PASS in .env, update n8n SMTP credential |
| SPRS trigger webhook | 🟡 404 on last step | Workflow 02's "Trigger SPRS Recalculate" hits internal n8n webhook that doesn't resolve; SPRS runs via FastAPI already |

## How to Activate n8n Workflows (when ready)
1. SSH to VM: `ssh mrt@10.10.110.41`
2. Open n8n: https://n8n.cmmc4msp.on-nex.us (admin@cmmc4msp.on-nex.us / from .env)
3. Open each workflow, assign credentials, toggle Active
4. Or: Update Anthropic credential with real key, then activate all via n8n UI

## Data Sources

- CMMC Information Institute self-assessment spreadsheet (110 controls source)
- NIST SP 800-171 Rev 2
- DoD Assessment Methodology v1.2.1

---

_Update regularly — stale data limits Claude's usefulness as an analytical partner._
