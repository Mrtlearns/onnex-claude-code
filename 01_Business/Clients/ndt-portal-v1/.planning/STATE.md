---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: automated-quote-pipeline
status: "Phase 6 COMPLETE — v1.0 portal fully deployed; Phase 7 (automated pipeline) planned, not started"
last_updated: "2026-03-15T00:00:00Z"
last_activity: "2026-03-15 — v1.0 deployed: frontend dist + docker-compose + n8n + gotenberg live on ndtv1 server; CI/CD runner confirmed active; disk expanded to 40GB"
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 0
  completed_plans: 0
---

# STATE — NDT Portal v1

## Current Position

Phase: Phase 7 — Automated Quote Pipeline — NOT STARTED (planning required)
Status: v1.0 COMPLETE — all 6 foundation phases shipped and deployed
Last activity: 2026-03-15 — ndtv1 server deployment: n8n + gotenberg live, CI/CD runner active, 40GB disk

## v1.0 Retrospective Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation — Docker Stack | Complete |
| 2 | RT Calculator | Complete |
| 3 | UT Calculator | Complete |
| 4 | Quote Management | Complete |
| 5 | Dashboard + Settings + Integration Stubs | Complete |
| 6 | Tools / n8n Embedded + CI/CD Pipeline | Complete |

## v1.1 Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 7 | Automated Quote Pipeline (n8n workflows) | Not started |

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Automation tool | n8n (self-hosted, embedded) | Visual history, retry logic, email/SF triggers; no OpenClaw in this project |
| LLM step | Claude API via n8n LangChain node | One hop for unstructured email extraction; structured inputs skip it |
| PDF | n8n HTML template node (Gotenberg available as fallback) | Avoids Puppeteer in API Docker image |
| PostgREST numeric types | Returns as string — use parseFloat(String(n)) in frontend | Discovered during Quotes page blank-screen bug; important gotcha |
| CI/CD executor | Shell runner on ndtv1 server | Runner already installed at /home/gitlab-runner; tag: ndtv1 |
| Disk management | Clean /home/mrt/.npm + gitlab-runner/builds when tight | n8n (~2GB) + gotenberg (~2.7GB) are large; 40GB disk now |

## Active Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| integration env vars not set | HMAC + n8n token validation stubs commented out | Add SF_*, EMAIL_*, N8N_WEBHOOK_SECRET to docker-compose.yml env section |
| n8n workflows not built | No automated pipeline yet | WF-1 through WF-4 need to be built in n8n UI at /n8n/ |

## Session Log

| Date | Work Done |
|------|-----------|
| 2026-03-15 | v1.0 complete: E2E Playwright tests, QuotesApp grand_total fix, Tools page + n8n iframe, sidebar Tools nav, docker-compose n8n + gotenberg, traefik n8n route, CI/CD pipeline (.gitlab-ci.yml), runner confirmed, ndtv1 server deployed |
