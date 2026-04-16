# NDT Portal v1 — Project Context

## What We're Building

Web-based quoting and inspection management portal for Onnex's NDT (Non-Destructive Testing) clients. Replaces manual Excel-based quoting with a structured, automated system. Handles UT (Ultrasonic Testing) and RT (Radiographic Testing) quote generation, email/Salesforce intake via n8n automation, PDF quote delivery, and an embedded n8n Tools workspace.

## Current Milestone: v1.1 — Automated Quote Pipeline (In Progress)

**Goal:** End-to-end automated quoting via n8n workflows. Emails, Salesforce leads, and API calls route through n8n → Claude API extraction → validation → NDT Portal API → PDF → reply.

**Key items:**
- WF-1: Email → UT Quote → PDF reply (n8n)
- WF-2: Email → RT Quote → PDF reply (n8n)
- WF-3: Salesforce Flow webhook → UT Quote → SF writeback (n8n)
- WF-4: Unified classifier (optional — Claude LangChain node)
- Activate HMAC + n8n token validation stubs in integrations.ts
- Add integration env vars to docker-compose.yml

## Previous Milestone: v1.0 — Portal Foundation (COMPLETE — 2026-03-15)

**Result:** Full portal deployed to ndtv1 server. RT + UT calculators, quote history with status lifecycle, dashboard, settings/integrations, embedded n8n Tools page. GitLab CI/CD pipeline with shell runner. 8 Docker services (traefik, nginx, postgres, postgrest×2, api, n8n, gotenberg).

## Tech Stack

| Component | Technology |
|-----------|------------|
| Edge / Proxy | Traefik v3.3 (path-based routing on :8888) |
| Frontend | React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS |
| Backend API | Node.js + Express (TypeScript, compiled to dist/) |
| Database | PostgreSQL 16 (via postgrest v12.2.3 — separate schemas: ut, rt) |
| Automation | n8n (self-hosted, embedded under /n8n/ path) |
| PDF Generation | Gotenberg 8 (Chromium-based, for quote PDFs) |
| Static Serving | nginx 1.27-alpine |
| CI/CD | GitLab Runner (shell executor, tag: ndtv1) |

## Deployment

| Item | Value |
|------|-------|
| Server IP | `10.10.110.32` |
| Public URL | `https://ndtv1.onnex.cox.playsap.us` |
| Docker Compose dir | `/opt/ndt-portal/` |
| Frontend dist | `/opt/ndt-portal/dist/` |
| API dist | `/opt/ndt-portal/api/dist/` |
| n8n data | Docker volume `ndt-portal_n8n_data` |

```bash
# SSH access
ssh root@10.10.110.32  # password: Poll0000

# Deploy (manual)
cd /opt/ndt-portal && docker compose up -d

# CI auto-deploys on push to main touching projects/ndt-portal-v1/**
```

## Architecture

- **Traefik** routes by path prefix: `/api/ut/*` → api (priority 30), `/api/rt/*` → api (priority 30), `/api/ut` → postgrest-ut (priority 20), `/api/rt` → postgrest-rt (priority 20), `/n8n` → n8n:5678 (priority 10), `/` → nginx (priority 1)
- **PostgREST** exposes postgres `ut` and `rt` schemas directly as REST APIs
- **n8n** runs embedded under `/n8n/` sub-path, same-origin iframe in Tools page
- **Gotenberg** handles PDF rendering for quote documents

## Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Automation orchestration | n8n (self-hosted) | Visual execution history, retry logic, email/SF triggers built-in |
| LLM step | Claude API via n8n LangChain node | Only needed for unstructured email extraction — one LLM hop |
| PDF generation | n8n HTML template node (deferred: Gotenberg) | Avoids Puppeteer in API image; Gotenberg available if needed |
| Salesforce writeback | n8n HTTP → SF REST API | Keeps API stateless; n8n handles OAuth token lifecycle |
| PostgREST numeric | grand_total returns as string from DB | Fixed in frontend with parseFloat(String(n)) — do not assume numeric type from PostgREST |
| n8n sub-path | N8N_PATH=/n8n/ env var | No Traefik prefix stripping needed; n8n natively handles sub-path |

## Integration Endpoints (built, security stubs not yet activated)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ut/integrations/salesforce/quote` | Salesforce Flow webhook → UT quote |
| `POST /api/ut/integrations/email/quote` | Inbound email webhook → UT quote |
| `POST /api/ut/integrations/n8n/quote` | n8n HTTP Request node → UT quote |

Security stubs (HMAC + X-N8N-Token) are commented out in `api/src/routes/integrations.ts` pending env var deployment.
