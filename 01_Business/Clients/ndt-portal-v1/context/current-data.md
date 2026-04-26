# NDT Portal — Current Data

> Update after each development session or client interaction.
> Last updated: 2026-04-26

## Development Status
- Pipeline architecture: Complete
- **Auth (OIDC/Authentik): Working end-to-end** — full login flow verified with Playwright 2026-04-07
- **Email-to-quote pipeline: Working** — Gmail polling → classify → customer lookup → BOM match → UT quote → auto-reply (2026-04-14)
- **Inbox UI: Live** — email quote detail modal with LLM extraction + part match display; forwarded email parsing (2026-04-20)
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
- **Pipeline Tester: Added** — `pipeline-tester.ts` API route + `UtPipelineTesterTab.tsx` frontend tab, DB migration 050 (2026-04-21)
- **Quote fallback: Added** — unknown customer falls back to prospect defaults instead of 404 (2026-04-20)
- **Forwarded email parsing: Fixed** — inbox route parses forwarded body for original sender; customer lookup on internal forward (2026-04-20)
- **ndt-classify.ts: Added** — NDT classification helper module (2026-04-21)
- **Permissions system: Extended** — `diagram-analyses.permissions.ts` + `inbox.permissions.ts` added (2026-04-21)
- **Migrations 042–050: Applied** — internal sender, UT formula fixes, email domain, quote part lookup, UT link, 2026 pricing update, deferred customers, placeholders, pipeline test messages

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

## CI/CD Status (2026-04-26)
- **GitLab runner (`ndtv1-shell-runner`)**: Online, healthy
  - Runner registered to `ndt-portal-v1` (project ID 7, runner ID 1)
  - Last successful pipelines: 189 ✅, 191 ✅ (fixed named-container race), 192 pending
  - Pipeline 190 failed: `collabora` / `nextcloud-*` named-container name conflict in compose retry — fixed in `.gitlab-ci.yml`
- **GitLab remote** (`gitlab.botonomy.xyz/mrt/ndt-portal-v1`): Synced to `63b7ef2` ✓
- **GitHub remote** (`github.com/Mrtlearns/ndt-portal-v1`): Synced to `63b7ef2` ✓
- **VM `/opt/ndt-portal`**: Current — all images rebuilt 2026-04-26, stack running 22 containers

## Docker Stack (22 services) — versions as of 2026-04-26
| Service | Image | Version |
|---------|-------|---------|
| traefik | traefik | v3.6 |
| postgres (NDT) | postgres | 16-alpine |
| postgrest-rt/ut | postgrest/postgrest | v14.10 |
| nginx | nginx | 1.30-alpine |
| gotenberg | gotenberg/gotenberg | 8 (latest 8.x) |
| n8n | n8nio/n8n | latest |
| authentik + worker | ghcr.io/goauthentik/server | **2026.2.2** |
| authentik-db | postgres | 16-alpine |
| authentik-redis | redis | 7-alpine |
| nextcloud-app | nextcloud | **33-apache** (33.0.2.2) |
| nextcloud-db | mariadb | 11 |
| nextcloud-redis | redis | 7-alpine |
| collabora | collabora/code | latest |
| presidio-analyzer | mcr.microsoft.com/presidio-analyzer | latest |
| presidio-image-redactor | mcr.microsoft.com/presidio-image-redactor | latest |
| ndt-api/comply/sanitize/gateway/msg-api | custom | built 2026-04-24 |

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

## Recent Changes (2026-04-22 → 2026-04-26)
- **Full infrastructure upgrade**: all Docker images updated (see table above)
- **Authentik 2024.12 → 2026.2.2**: Required stepped upgrade via 2025.4 → 2025.8 → 2026.2.2 (2025.12 has broken migration `0056_user_roles`; upstream bug)
- **Nextcloud 30 → 33**: Sequential: 30→31→32→33 (cannot skip versions; ~70s per step)
- **PostgREST v12.2.3 → v14.10**: Drop-in replacement, no config changes needed
- **29 orphan Docker volumes pruned**, 282MB build cache cleared
- **CI fix**: named-container conflict (collabora/nextcloud-*) in retry logic now force-removed before retry
- **seed.py**: `ak_groups` → `groups` (Authentik 2026.2.2 deprecation)
- **ndt-portal-v1 git repo**: initialized locally as own repo, connected to GitLab + GitHub (was only in root workspace)
- **Backups at** `/opt/backups/2026-04-26/`: NDT PG (41MB), Authentik PG (49MB), Nextcloud MariaDB (4.6MB)

## Recent Changes (since 2026-04-17)
- Stage 2 model updated: anthropic/claude-sonnet-4-5 → anthropic/claude-sonnet-4-6 (rt-pipeline.ts)
- current-data.md status corrected after full codebase audit — Stage 1, Stage 2, R3F renderer all complete
- Pipeline Tester feature added (API route + UT frontend tab + DB migration)
- Quote unknown-customer fallback to prospect defaults
- Forwarded email parsing fix for original sender extraction
- ndt-classify.ts helper module added
- RBAC permissions files for diagram-analyses and inbox routes
- Migrations 042–050 applied (email domain, UT formulas, pricing, deferred customers)
- CI/CD: ndt-portal-v1 git repo initialized locally; synced to GitLab + GitHub (2026-04-23)
- CLAUDE.md updated: manual deploy path documented, CI/CD 503 history noted

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
