# NDT Portal — Current Data

> Update after each development session or client interaction.
> Last updated: 2026-04-17

## Development Status
- Pipeline architecture: Complete
- **Auth (OIDC/Authentik): Working end-to-end** — full login flow verified with Playwright 2026-04-07
- **Email-to-quote pipeline: Working** — Gmail polling → classify → customer lookup → BOM match → UT quote → auto-reply (2026-04-14)
- **Inbox UI: Live** — email quote detail modal with LLM extraction + part match display
- ndtv1-comply service: Dockerized, in docker-compose stack
- ndtv1-sanitize service: Dockerized, in docker-compose stack
- ndtv1-gateway service: Dockerized, in docker-compose stack (Claude CLI provider added 2026-04-14)
- **Stage 1 LLM (classifier): Complete** — 9 part types, 27 geometry primitives, Zod validator, pipeline integration (2026-04-17 audit)
- **Stage 2 LLM (RT analysis): Complete** — base-rt-analyst.txt + 9 module prompts, RTAnalysisSchema validator, retry logic, Nextcloud spec injection (2026-04-17 audit)
- **R3F renderer: Complete** — PartInspector, SceneCanvas, all 5 zone types (Ring/Line/Patch/Sphere/Arc), geometry factory, inspector store, PNG+STL export (2026-04-17 audit)
- n8n workflows: WF-1 through WF-7 built (WF-6 Gmail poller, WF-7 auto-reply added 2026-04-14)
- UT calculator: Working — formulas aligned with Excel spreadsheet
- Customer-specific rule sets: UI built (2026-04-09)
- Workshop dashboard: SSE real-time, DB migration 027

## Auth Status (2026-04-09)
- Authentik OIDC provider: Configured — implicit consent flow active
- PKCE over HTTPS: Working — portal served at `https://ndt-v1.on-nex.us` (SSL terminates at pfSense)
- VITE env vars: `VITE_AUTHENTIK_ISSUER=https://ndt-v1.on-nex.us/application/o/ndt-portal/`
- Redirect URIs: both `https://ndt-v1.on-nex.us/login/callback` and `http://10.10.110.32:8888/login/callback`
- Traefik: `X-Forwarded-Proto: https` injected on all Authentik routes so discovery doc returns HTTPS issuer
- Token validity: `access_token_validity=hours=8`, `refresh_token_validity=days=7` (Authentik string format)
- DB wipe survival: `authentik/seed.py` committed + run by CI every deploy
- Login flow: stable — `login` memoized with `useCallback`, single-fire guards on LoginPage + LoginCallback
- Playwright tests: Both passing — full flow + auto-redirect (9.0s total)
- Stable JWT signing cert: Unmanaged RS256 cert in seed.py prevents Authentik auto-rotation issues
- Auto re-login on 401: AuthContext handles expired tokens gracefully

## Docker Stack (20 services)
traefik, postgres, postgrest-rt, postgrest-ut, nginx, gotenberg, n8n, msg-api, presidio-analyzer, comply, sanitize, gateway, api, nextcloud-db, nextcloud-redis, nextcloud-app, authentik-db, authentik-redis, authentik, authentik-worker

## API Routes (19 modules)
admin, bom, diagram-analyses, documents, email-checks, feedback, inbox, inspection-types, integrations, quote, quotes, rbac, rt-analyze, rt-plan, rt-quote, settings, sf-analysis, ut-calculate, ut-rules, workshop

## n8n Workflows
| Workflow | Purpose |
|----------|---------|
| WF-1 | Email → UT quote |
| WF-2 | Email → RT quote |
| WF-3 | Salesforce → UT quote |
| WF-4 | Unified classifier |
| WF-5 | Pipeline orchestrator |
| WF-6 | Gmail scheduled poller (inbox checker) |
| WF-7 | Email auto-reply |

## Client Pipeline
- Active prospects: 0
- Demos scheduled: 0

## Technical Metrics
- Target pipeline latency: < 60 seconds end-to-end
- Renderer budget: 500K triangles at 60 FPS
- LLM: Anthropic SDK primary, Ollama fallback

## Recent Changes (since 2026-04-17)
- Stage 2 model updated: anthropic/claude-sonnet-4-5 → anthropic/claude-sonnet-4-6 (rt-pipeline.ts)
- current-data.md status corrected after full codebase audit — Stage 1, Stage 2, R3F renderer all complete

## Changes (2026-04-09 → 2026-04-15)
- Email-to-quote pipeline built end-to-end (steps 8, 9, 11)
- WF-6 Gmail poller + WF-7 auto-reply n8n workflows
- Inbox endpoint with bounce/NDR rejection
- AUTO_REPLY_OVERRIDE safety (all auto-replies → mrt@on-nex.com)
- Customer lookup via Salesforce contacts + part BOM lookup
- Email quote detail modal with LLM extraction display
- Stable JWT signing cert in Authentik seed (prevents rotation issues)
- Auto re-login on 401 from RBAC API
- Claude CLI provider added to gateway
- UT formula alignment with Excel spreadsheet
- Customer-specific rule set management UI
