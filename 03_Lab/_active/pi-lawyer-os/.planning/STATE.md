---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: platform-scale
status: "v4.1 COMPLETE — product phases done; Phase 13 production readiness in progress (3/6 items done)"
last_updated: "2026-03-21T00:00:00Z"
last_activity: "2026-03-21 — Phase 13 partial: Traefik webhook fix, SMTP env vars, CI/CD rewrite complete. E2E sweep + doc overhaul complete."
progress:
  total_phases: 13
  completed_phases: 12
  total_plans: 13
  completed_plans: 12
---

# STATE — PI Lawyer OS

## Current Position

Milestone: v3.3 — Multilingual + Firm Ops
Status: **COMPLETE ✅** — Spanish i18n (EN/ES toggle), user management (create/deactivate staff), audit log (INSERT/UPDATE/DELETE triggers on leads+cases), attorney performance dashboard deployed.

**Next:** Phase 11 — Advanced AI (v4.0)

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Revenue Protection — Lead Ingestion + Automation | **Complete ✅** |
| 2 | Case Management Core | **Verified ✅** |
| 3 | Document AI | **Verified ✅** (AI calls pending billing credits) |
| 4 | Revenue Growth | **Verified ✅** |
| 5 | Billing + Finance | **Verified ✅** |
| 6 | Client Portal + Analytics | **Verified ✅** |
| 7 | Automation Activation | **Complete ✅** |
| 8 | Lead Intelligence | **Complete ✅** |
| 9 | Growth Channels | **Complete ✅** |
| 10 | Multilingual + Firm Ops | **Complete ✅** |
| 11 | Advanced AI | **Complete ✅** |
| 12 | Platform Scale | **Complete ✅** |
| 13 | Production Readiness | **In Progress 🔄** (3/6 items) |

## Deployment Patterns & Lessons Learned

### Frontend Code Changes — Deploy Pattern
The server has NO git repo. Docker image must be explicitly rebuilt after any code change.

**Steps required every time frontend code changes:**
1. SCP changed files to server: `scp <file> root@10.10.110.33:/opt/pi-lawyer-os/frontend/src/...`
2. Rebuild image (MUST use `--no-cache` — Docker caches the COPY layer and will silently skip new files otherwise):
   `docker compose build --no-cache frontend`
3. Redeploy container: `docker compose up -d --no-deps frontend`

**Root cause of silent failure:** Docker's layer cache preserves the `COPY . .` layer even when source files change on disk. Without `--no-cache`, the build completes successfully but serves the old code.

### Domain/APP_DOMAIN Change — Deploy Pattern
When `APP_DOMAIN` changes in `.env`, ALL containers with Traefik routing labels must be recreated — not just `traefik` and `frontend`. Each container bakes `${APP_DOMAIN}` into its labels at start time. Traefik reads labels from running containers; stale labels mean routes point to the old domain.

**Affected containers:** `traefik`, `frontend`, `auth`, `postgrest` (and any others with `traefik.http.routers.*.rule` labels)

**Command:** `docker compose up -d --no-deps traefik frontend auth postgrest`

**Verification:** `docker inspect <container> --format "{{json .Config.Labels}}"` — check `traefik.http.routers.*.rule` shows new domain.

### Current Live URL
- App: https://pil.on-nex.us/ (landing page) → /app (auth redirect) → /dashboard
- Edge Traefik routes `pil.on-nex.us` → `http://10.10.110.33:80` (pilaweros-traefik) with `passHostHeader: true`

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui | Blueprint decision; fast, modern, composable |
| Backend | PostgreSQL 15 + PostgREST | Auto-REST from schema; low backend code overhead |
| Embeddings | pgvector (defer to Phase 3) | Not in postgres:15 base image; add when needed |
| Graph DB | Neo4j | Lead→Partner, Lead→Case, Case→Attorney relationships |
| Automation | n8n self-hosted | Consistent with all Onnex verticals |
| Comms | Twilio (SMS + voice) | Speed-to-lead and missed call recovery |
| AI | Claude API (claude-sonnet-4-6) | Onnex standard |
| Auth | JWT (simple) | Defer Authentik to v2 |
| Multi-tenant | Yes, firm_id on all core tables | Day 1 requirement for SaaS model |
| Deployment | Docker Compose → 10.10.110.33 | Per-client VM model |
| Product name | PI Lawyer OS | ChatGPT "PI Growth OS" = Revenue Protection module within Phase 1 |
| Traefik TLS | HTTP only for IP deployments | Let's Encrypt requires a domain; enable per-client with real domain |
| Auth bcrypt | bcrypt library direct (not passlib) | passlib bcrypt detection bug on Python 3.12 |

## Open Questions / Deferred Items

- **Traefik n8n webhook routing:** `/n8n/webhook/*` returns 404 externally — fix is documented in Phase 13 PLAN.md (strip-prefix middleware, 3-line config change). Must fix before enabling real Twilio webhooks in production.
- **Anthropic credits:** add credits at console.anthropic.com to activate live AI calls (key valid, balance zero; all AI endpoints have stubs so zero code changes needed when credits added)
- **Autonomous Wyatt orchestration (Wyatt → n8n trigger):** deferred from Phase 11; not in Phase 13 scope; file as v6.0 if needed
- **Authentik SSO:** deferred from Phase 12; not in Phase 13 scope; defer to enterprise tier

## Resolved Decisions (Phases 07–12)

| Decision | Answer |
|----------|--------|
| Twilio mode (Phase 07) | Test mode first (`TWILIO_TEST_MODE=true`); real creds = per-client onboarding step |
| Embedding model (Phase 08) | OpenRouter `text-embedding-3-small` — stub with `[0.1]*1536` when key=stub |
| GMB approach (Phase 09) | Researcher agent evaluates at Wave 2.1; default to SerpAPI if OAuth friction high |
| Wyatt MCP hosting (Phase 11) | Sidecar script `tools/postgrest-mcp.py` inside openclaw container |
| Stripe billing model (Phase 12) | Flat monthly per firm ($800–$1,500/mo); active/paused/cancelled lifecycle |

## Session Log

| Date | Work Done |
|------|-----------|
| 2026-03-15 | Project directory created; GSD .planning/ scaffold initialized |
| 2026-03-16 | v0 complete — all .planning/ docs rewritten from ChatGPT blueprint; tech stack locked; reference artifacts extracted from zip |
| 2026-03-16 | Phase 1 plan created — 7 waves, 20 tasks — ready to execute |
| 2026-03-16 | Phase 1 built — Waves 1–6 complete; all 56 application files written |
| 2026-03-16 | Phase 1 verified — TypeScript clean (0 errors), all 56 files present, 4 n8n workflows valid JSON |
| 2026-03-16 | Phase 1 deployed — stack live on 10.10.110.33; login/JWT/CRUD verified; deployment fixes applied (HTTP routing, DB schema, auth bcrypt) |
| 2026-03-16 | v1.0 milestone complete — advancing to v1.1 Case Management Core |
| 2026-03-16 | Phase 2 planned — 8 waves, 25 tasks; PLAN.md written |
| 2026-03-16 | Phase 2 built — all waves complete; 26 files written; TypeScript clean (0 errors); n8n SOL workflow written |
| 2026-03-16 | Phase 2 deployed — migration 002 applied; files service live; all 7 Phase 2 API endpoints verified on 10.10.110.33 |
| 2026-03-16 | Phase 2 verified — all automated checks pass; 8/11 criteria auto-verified; 3 require manual UAT (lead convert, document upload, SOL badge rendering) |
| 2026-03-16 | v1.1 milestone complete — advancing to v1.2 Document AI |
| 2026-03-16 | Phase 3 planned — 6 waves, 19 tasks; PLAN.md written |
| 2026-03-16 | Phase 3 built — all waves complete; ai service, 9 frontend files; TypeScript clean (0 errors) |
| 2026-03-16 | Phase 3 deployed — migration 003 applied; pilaweros-ai live; /ai/health responding on 10.10.110.33 |
| 2026-03-16 | Phase 3 verified — all infra/code/DB checks pass; TypeScript clean; API key valid; AI calls blocked by zero credit balance (billing issue, not code) |
| 2026-03-16 | v1.2 milestone complete — advancing to v2.0 Revenue Growth |
| 2026-03-16 | Phase 4 planned — 6 waves, 21 tasks; partners/referrals/resurrection/dashboard PLAN.md written |
| 2026-03-16 | Phase 4 built — migration 004 applied; partners/partner_referrals tables live; n8n workflows written; Partners page, PartnerDetail, ResurrectionQueueWidget, ReferralStatsWidget built; frontend deployed |
| 2026-03-16 | Phase 4 firm_id fix — applied JWT-based DEFAULT to partners + partner_referrals (new) and all 9 existing tables; POST /api/partners verified end-to-end |
| 2026-03-16 | Phase 4 verified — all automated criteria pass; n8n workflows imported via CLI (setup wizard bypass); 2/7 criteria need manual UAT (n8n Twilio activation, browser smoke test) |
| 2026-03-16 | v2.0 milestone complete — advancing to v2.1 Billing + Finance |
| 2026-03-16 | Phase 5 planned — 6 waves, 15 tasks; settlement tracker/fee ledger/disbursement calculator/summary report PLAN.md written |
| 2026-03-16 | Phase 5 built — migration 005 applied; settlement_offers/case_costs/case_settlements tables live; 4 components + 3 hooks + apiDelete added; Billing tab wired into CaseDetail; frontend deployed |
| 2026-03-16 | Phase 5 verified — all 6 criteria pass; GENERATED columns confirmed; all billing strings in bundle; 9/9 services Up |
| 2026-03-16 | v2.1 milestone complete — advancing to v2.2 Client Portal + Analytics |
| 2026-03-16 | Phase 6 planned — 6 waves, 19 tasks; client portal auth + analytics views + 3 new pages PLAN.md written |
| 2026-03-16 | Phase 6 built — migration 006 applied; client_users table + 4 analytics views live; portal-login/portal-register auth endpoints; usePortalAuth/usePortalCase/useAnalytics hooks; PortalLogin + ClientPortal + Analytics pages; DocumentPanel share toggle; PortalAccessPanel; Analytics nav link |
| 2026-03-16 | Phase 6 deployed — all 9 services Up; /auth/portal-login returning 401 (live); /api/v_analytics_case_summary returning 200 |
| 2026-03-16 | Phase 6 verified — all 6 criteria pass; analytics views return data; portal-login/portal-register live; share toggle in bundle; TypeScript clean |
| 2026-03-17 | v2.2 milestone COMPLETE — all 6 phases built, deployed, verified; full PI Lawyer OS product live on 10.10.110.33 |
| 2026-03-20 | Phase 07 Automation Activation COMPLETE — all 6 n8n workflows verified; fixed SplitInBatches v3 output mapping bug, Code node $input.all() fix in resurrection, TWILIO_TEST_MODE stub pattern confirmed; Playwright 7/8 pass; v3.0 archived |
| 2026-03-20 | Phase 08 Lead Intelligence COMPLETE — pgvector installed (pgvector/pgvector:pg15), migration 009 applied; lead_score/is_duplicate/duplicate_of_lead_id columns; case_embeddings table; check_lead_duplicate function; /score-lead + /embed-case + /similar-cases AI endpoints; SimilarCasesPanel on CaseDetail; score badge + dup banner on LeadDetail; lead-scoring n8n workflow (5-min cron); v3.1 archived |
| 2026-03-20 | Phase 09 Growth Channels COMPLETE — migration 010 applied (date_of_loss/fault/has_medical on leads, source_attribution_stats view); after-hours-ivr.json + gmb-review-monitor.json n8n workflows (9 total active); POST /auth/intake public endpoint; IntakeForm.tsx multi-step form at /intake; Analytics Source Attribution section; Playwright 62/62 pass; v3.2 archived |
| 2026-03-20 | Phase 10 Multilingual + Firm Ops COMPLETE — migration 011 applied (preferred_language on leads/clients, active on users, audit_log table + triggers, attorney_performance view); i18n/es.ts + I18nProvider (EN/ES toggle in Settings); POST /auth/create-user + PATCH /auth/update-user + GET /auth/list-users (admin-only); deactivated user 403 on login; AuditLogPanel on LeadDetail + CaseDetail; AttorneyPerformanceTable on Analytics; Playwright 13/13 pass (75/81 total); v3.3 archived |
| 2026-03-20 | Phase 11 Advanced AI COMPLETE — migration 012 applied (document_chunks + objection_library seeded 20 entries); /ai/embed-document + /ai/search-documents RAG endpoints; fire-and-forget embed on file upload; semantic search UI in DocumentPanel; Wyatt DB MCP server (postgrest-mcp.js + openclaw.json registration + SOUL.md update); Objection Library tab in Settings; USER.md objection reference; enhanced demand letter (providers/costs/offers data pull); Playwright 11/11 pass (85/91 total); v4.0 archived |
| 2026-03-20 | Phase 12 Platform Scale COMPLETE — migration 013 applied (logo_url/primary_color/sms_signature/smtp fields on firms, document_templates table + 3 seeded templates, stripe_customer_id/subscription columns); auth login returns firm branding; Sidebar uses firm logo/color; Settings: Firm Branding card + Document Templates card + SMTP config; Playwright 8/8 pass (94/94 total suite 100%); v4.1 archived |
| 2026-03-21 | Phase 13 partial: Traefik n8n webhook strip-prefix ✅, SMTP env vars in docker-compose ✅, CI/CD pipeline rewritten (.gitlab-ci.yml: lint→test→deploy→health-check) ✅. Remaining: TLS/Let's Encrypt, Stripe billing service, email nodes in n8n workflows. Demo data expanded (5 partners, 12 leads, 5 cases all statuses, 19 docs, TTG card added in Settings). E2E test suite swept — all 14 files updated with data assertions, API round-trips, TTG tests, Demand Letter tab, Documents content validation, portal login test; ~115 tests total. Docs overhauled: README.md full feature list + services table + Phase 13 status; ROADMAP.md phase table updated to Phase 13; docs/DEMO-DATA.md + docs/TESTING.md + docs/WYATT.md created. |
