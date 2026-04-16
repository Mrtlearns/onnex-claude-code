# PI Lawyer OS — Roadmap

> **Status:** v0 complete — architecture locked, Phase 1 ready to build.

---

## Phase 1 — Revenue Protection Foundation (Weeks 1–4)

**Goal:** Working multi-tenant lead capture, speed-to-lead automation, and missed call recovery with live dashboard.

**This is the sales demo.** A prospect firm should be able to see their leads flowing in and getting auto-responded to within 2 minutes.

**Success criteria:**
- [ ] Docker Compose stack healthy: traefik, frontend, postgres, postgrest, n8n, neo4j
- [ ] Core schema deployed: firms, leads, communications + pgvector
- [ ] Lead ingestion working: web form + Twilio inbound webhook
- [ ] Speed-to-lead: SMS sent within 2 min of lead creation (n8n)
- [ ] Missed call recovery: SMS → 2h wait → follow-up SMS (n8n)
- [ ] Intake completion reminders running (n8n)
- [ ] Retainer follow-up sequence running (n8n)
- [ ] Unified lead timeline visible in UI
- [ ] Response time dashboard live with KPI cards
- [ ] JWT auth with firm_id scoping working
- [ ] CI/CD auto-deploys to 10.10.110.33

**Week 1–2: Foundation + Lead Ingestion**
- Docker Compose stack (traefik + frontend + postgres + postgrest + n8n + neo4j)
- Database schema: firms, leads, communications + pgvector extension
- PostgREST API wired up
- Lead ingestion web form
- Twilio webhook receiver

**Week 3–4: Automation + Dashboard**
- n8n: speed-to-lead workflow
- n8n: missed call recovery workflow
- n8n: intake completion reminders
- n8n: retainer follow-up sequence
- Frontend: lead list + lead detail + unified timeline
- Frontend: response time dashboard with KPI cards

---

## Phase 2 — Case Management Core (Weeks 5–6)

**Goal:** Full case CRUD, client management, SOL tracking, document upload.

**Success criteria:**
- [ ] Case create from signed lead
- [ ] Case list + detail with full timeline
- [ ] Client intake form
- [ ] SOL tracking + 90/60/30 day alerts
- [ ] Medical records tracker per case
- [ ] Task + deadline management
- [ ] Document upload + tagging
- [ ] Specials total calculation

---

## Phase 3 — Document AI (Week 7–8)

**Goal:** AI-powered document processing using Claude API.

**Success criteria:**
- [ ] Medical record upload → AI extracts injuries, treatment, specials
- [ ] Medical summary card per provider
- [ ] Demand letter draft generation
- [ ] Document auto-classification on upload
- [ ] AI intake summary from notes/transcript

---

## Phase 4 — Revenue Growth (Week 9–12)

**Goal:** Automated lead resurrection and referral flywheel.

**Success criteria:**
- [ ] Lost lead re-engagement sequences (n8n)
- [ ] Partner referral tracking
- [ ] Review-to-case conversion monitoring
- [ ] Revenue share reporting

---

## Phase 5 — Billing + Finance (Q3 2026)

**Goal:** Settlement tracking and contingency fee calculation.

**Success criteria:**
- [ ] Settlement offer/counter tracker
- [ ] Disbursement calculator
- [ ] Fee ledger

---

## Phase 6 — Client Portal + Analytics (Q3 2026)

**Goal:** External client portal and revenue analytics.

**Success criteria:**
- [ ] Client portal with case status + document access
- [ ] Analytics dashboard (case values, settlement rates, referral attribution)
- [ ] Multi-firm admin view (Onnex oversight)

---

## Phase Table — All Phases

| Phase | Milestone | Name | Status |
|-------|-----------|------|--------|
| 01 | v1.0 | Revenue Protection Foundation | Complete ✅ |
| 02 | v1.1 | Case Management Core | Complete ✅ |
| 03 | v1.2 | Document AI | Complete ✅ |
| 04 | v2.0 | Revenue Growth | Complete ✅ |
| 05 | v2.1 | Billing + Finance | Complete ✅ |
| 06 | v2.2 | Client Portal + Analytics | Complete ✅ |
| 07 | v3.0 | Automation Activation | Complete ✅ |
| 08 | v3.1 | Lead Intelligence | Complete ✅ |
| 09 | v3.2 | Growth Channels | Complete ✅ |
| 10 | v3.3 | Multilingual + Firm Ops | Complete ✅ |
| 11 | v4.0 | Advanced AI | Complete ✅ |
| 12 | v4.1 | Platform Scale | Complete ✅ |
| 13 | v5.0 | Production Readiness | In Progress 🔄 |

## Phase 13 — Production Readiness (v5.0)

**Goal:** Close the operator infrastructure gaps before first client onboarding.

| Item | Status |
|------|--------|
| Traefik n8n webhook strip-prefix routing fix | Complete ✅ |
| SMTP env vars in docker-compose | Complete ✅ |
| CI/CD pipeline rewrite (lint → test → deploy → health-check) | Complete ✅ |
| TLS / Let's Encrypt (requires real domain per client) | Planned |
| Stripe billing service (subscription create/cancel/webhook) | Planned |
| Email nodes in n8n workflows (welcome, SOL alert, settlement notice) | Planned |
