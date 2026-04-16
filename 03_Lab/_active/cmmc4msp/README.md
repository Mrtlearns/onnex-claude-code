# CMMC Compliance OS — cmmc4msp

> Multi-tenant SaaS platform for MSPs to manage CMMC Level 2 compliance across defense contractor clients.

**Stack:** Next.js 14 · FastAPI · PostgreSQL · Hasura · n8n · MinIO · Authentik · Traefik
**Deploy:** Single Ubuntu 24.04 VM · Docker Compose
**VM:** `10.10.110.41` (ssh alias: `cmmc4msp`)

---

## Status (2026-04-16)

| Layer | Status | Notes |
|-------|--------|-------|
| Infrastructure | Live | All 8 containers healthy |
| FastAPI | Live | 8 routers, JWT auth, SPRS calc |
| Hasura | Live | 16 tables tracked, 0 inconsistencies |
| PostgreSQL | Live | 4 migrations applied, 110 controls + 297 objectives seeded |
| MinIO | Live | 4 buckets, service account configured |
| n8n | Live | 8 workflows active |
| Next.js | Live | 9 pages, Authentik OIDC wired |
| Authentik | Live | OIDC configured, CMMC scope mapping deployed |
| E2E Pipeline | Working | Webhook -> extract -> Claude -> assessed in DB |

---

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| App | https://app.cmmc4msp.on-nex.us | Authentik SSO |
| API | https://api.cmmc4msp.on-nex.us | JWT (Authentik) |
| GraphQL | https://gql.cmmc4msp.on-nex.us | Hasura admin secret |
| n8n | https://n8n.cmmc4msp.on-nex.us | See .env |
| MinIO | https://minio.cmmc4msp.on-nex.us | See .env |

---

## Architecture

Multi-tenancy: Onnex (super_admin) -> MSPs (msp_admin) -> Client orgs (client_admin / client_user)
Auth: Authentik OIDC -> JWT with {role, org_id, msp_id} claims -> Hasura row-level permissions + FastAPI guards

---

## Core Workflow: Artifact Assessment (n8n Workflow 02)

1. Client uploads artifact -> FastAPI /api/artifacts/{pc_id}/upload
2. FastAPI generates MinIO presigned URL + fires n8n webhook
3. n8n extracts text -> FastAPI /api/artifacts/extract (POST, JSON body)
4. n8n fetches control details from PostgreSQL
5. n8n builds Claude prompt + calls OpenRouter (openrouter/auto)
6. n8n stores assessment + updates artifact.assessment_status = 'assessed'
7. n8n notifies FastAPI /api/webhooks/n8n/assessment-complete
8. FastAPI recalculates SPRS score

---

## Key n8n Production Gotchas

**HTTP Request typeVersion 1 uses `requestMethod` not `method`**
Patching nodes via DB: use `requestMethod: "POST"`. The `method` key is silently ignored, defaults to GET.

**Postgres executeQuery needs RETURNING on DML**
Without RETURNING, INSERT/UPDATE returns [] and breaks the execution chain.

**$env access requires N8N_BLOCK_ENV_ACCESS_IN_NODE=false**
n8n 2.x blocks env var access in expressions by default. Set this in docker-compose.

Fix scripts: `scripts/fix_*.py` — apply via SSH to VM if n8n is reinstalled.

---

## Repository Structure

```
cmmc4msp/
├── fastapi/              FastAPI application
│   ├── app/
│   │   ├── routers/      8 API routers
│   │   ├── services/     minio, n8n, sprs, extraction
│   │   └── deps.py       4-tier RBAC guards
│   └── tests/            51 pytest tests passing
├── n8n/workflows/        8 n8n workflow JSON definitions
├── postgres/migrations/  4 SQL migrations
├── scripts/              Deployment and fix scripts
├── context/              TELOS + strategy + current state
└── plans/                Implementation plans
```

---

## Common Commands (SSH to VM first: `ssh cmmc4msp`)

```bash
# Restart services
cd /opt/stacks/cmmc4msp && docker compose restart

# View logs
docker logs cmmc-fastapi --tail 50
docker logs cmmc-n8n --tail 50

# Run tests
docker exec cmmc-fastapi pytest -q
```

---

## Open Items

| Item | Priority | Notes |
|------|----------|-------|
| ~~Export fixed n8n workflows as JSON~~ | ~~High~~ | Done — exported via n8n API, committed 2026-04-16 |
| Fix SPRS webhook trigger | Medium | Last n8n step returns 404 on internal webhook; SPRS runs via FastAPI already |
| Canopy Aerospace onboarding | High | First real client — org/program setup in UI |
| SSP / POA&M PDF generation | Medium | Workflow 08 needs template wiring |
| SMTP credentials | Low | Needed for digest emails |

Full spec: `files/initialProjectDescriptiom.md`
