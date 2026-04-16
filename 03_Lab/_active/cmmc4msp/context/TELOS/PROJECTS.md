# Projects

## Active Projects

### CMMC Compliance OS (cmmc4msp)
- **Status:** MVP deployed — E2E pipeline confirmed working (2026-04-16)
- **Client / Vertical:** MSP vertical — Onnex as MSP operator, defense contractors as end clients
- **Goal:** Multi-tenant SaaS platform for CMMC Level 2 compliance management
- **Business Model:** SaaS subscription per MSP client org
- **VM:** 10.10.110.41 | Docker Compose | All 8 services live

**Completed:**
- [x] VM provisioned and all 8 services deployed
- [x] 4 database migrations (schema + 110 control seed + indexes + MSP hierarchy)
- [x] FastAPI 8 routers with 4-tier RBAC (super_admin / msp_admin / client_admin / client_user)
- [x] n8n 8 workflows imported and activated
- [x] Next.js 9 pages with Authentik OIDC
- [x] Hasura 16 tables tracked with row-level permissions
- [x] MinIO 4 buckets with service account
- [x] End-to-end: webhook -> extract -> Claude (openrouter/auto) -> assessment_status='assessed'
- [x] 51 pytest tests passing
- [x] n8n workflow 02 + 03 fully fixed and exported (webhook URL format, credential IDs, inline queries)
- [x] Canopy Aerospace and Defense onboarded (org + program + 110 controls seeded, linked to Onnex MSP)
- [x] SPRS Recalculate workflow 03 end-to-end working (tested 2026-04-16, score = -203 correct starting state)

**Next Actions:**
- [x] SSP / POA&M PDF generation (Workflow 08) — complete (2026-04-16)
- [x] Create Authentik user for Canopy client_admin — canopy.admin / Canopy@CMMC2026! created (2026-04-16)
- [ ] Upload first artifact for Canopy Phase 1 control and run assessment

## Onnex Platform Projects (always active)

### AI-OS Platform
- **Status:** Ongoing — infrastructure and framework
- **Stack:** Next.js, FastAPI, PostgreSQL/pgvector, Hasura, n8n, Docker

### Agency-OS
- **Status:** Ongoing — internal Onnex operations
