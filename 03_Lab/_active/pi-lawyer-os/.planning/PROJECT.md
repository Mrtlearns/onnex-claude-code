# PI Lawyer OS — Project Context

## What We're Building

Multi-tenant SaaS operating system for Personal Injury law firms. Sold and deployed by Onnex as a vertical AI-OS product. Each client firm gets a dedicated instance (Docker Compose, single VM per client) built on a shared codebase.

**Business model:** $40K+ build per client, $4K+ MRR per client.

**Target user:** PI firm owner / managing attorney, 5–20 attorney practice.

**Market:** Las Vegas (initial target), Los Angeles (Q3 2026 expansion).

---

## Product Structure

Two-phase product designed to build trust before full commitment:

### Phase 1 — Revenue Protection (the sales wedge)
Fixes the most painful, most measurable problem: firms lose cases because they're slow to respond to leads and miss calls.

- Speed-to-lead: SMS/call within 2 minutes of lead creation
- Missed call recovery: SMS → 2h wait → follow-up SMS (Twilio)
- Intake completion reminders
- Retainer follow-up automation
- Unified lead timeline
- Response time dashboard (KPI: < 2 min)
- Missed call recovery rate dashboard (KPI: > 40%)

### Phase 2 — Revenue Growth (the expansion)
Once trust is established and Phase 1 ROI is proven:

- Lost lead resurrection (re-engage old leads via automated sequences)
- Referral flywheel automation (attorney and medical provider networks)
- Review-to-case conversion
- Partner referral networks
- Revenue share tracking

---

## Business Model

| Component | Amount |
|-----------|--------|
| Build fee (per client) | $40,000+ |
| Monthly retainer (MRR per client) | $4,000+ |
| Phase 2 upsell | Additional $10K–$20K build |

**Las Vegas market:** ~180 PI firms, realistic penetration 5–15 firms in Year 1.
- 5 clients = $200K build + $20K MRR
- 10 clients = $400K build + $40K MRR
- 15 clients = $600K build + $60K MRR

**LA market (Q3 2026+):** 1,200–1,500 PI firms. 10x opportunity.

---

## Tech Stack (Decided)

| Component | Decision | Notes |
|-----------|----------|-------|
| Frontend | React 18 + TypeScript + Vite | Production-ready, fast dev |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Clean, modern law firm UI |
| State/Data | TanStack Query | Server state management |
| Forms | React Hook Form + Zod | Validated intake forms |
| Charts | Recharts | Dashboard KPI visualizations |
| Backend | PostgreSQL 15 + PostgREST | REST API auto-generated from schema |
| Embeddings | pgvector (1536-dim) | Similarity search, AI features |
| Graph DB | Neo4j | Lead→Partner, Lead→Case, Case→Attorney relationships |
| Automation | n8n (self-hosted) | All workflow orchestration |
| Comms | Twilio | SMS + voice call |
| AI | Claude API (claude-sonnet-4-6) | Intake summaries, document AI |
| Auth | JWT (simpler) | Defer Authentik to v2 |
| Deployment | Docker Compose → 10.10.110.33 | Per-client instance model |
| CI/CD | GitLab CI → ndtv1 runner | Consistent with NDT Portal pattern |

**Multi-tenant:** Yes, from day 1. `firm_id` on all core tables. Firms table is the root entity.

---

## Core Entities

| Entity | Description |
|--------|-------------|
| Firm | Tenant root. PI law firm. All data scoped to firm_id. |
| Lead | Prospective client — name, phone, email, injury type, source, status |
| Communication | SMS/call log linked to lead — channel, message, timestamp |
| Case | Active matter — linked from Lead when signed. SOL, status, attorney. |
| Attorney | Staff member at the firm — handles cases, receives alerts |
| Partner | Referral source — medical providers, other attorneys |

---

## AI Opportunities

**Phase 1 (Revenue Protection):**
- Intake summary: transcript → injury description + liability + next steps
- Lead scoring: classify Hot / Warm / Cold from intake data
- Response drafts: suggested SMS text for intake team

**Phase 2+ (Case Management + Document AI):**
- Medical record summarization (injuries, treatment dates, specials total)
- Demand letter drafting from case facts + medical summaries
- Document auto-classification on upload
- Settlement analysis against comparable cases
- SOL deadline alerts with AI review of case facts

---

## Deployment Model

Each client firm gets:
- Dedicated VM (10.10.110.33 pattern, new VM per new firm)
- Docker Compose stack: traefik, frontend, postgres, postgrest, n8n, neo4j
- Traefik handles routing + TLS
- GitLab CI auto-deploys on push

**Server:** 10.10.110.33 (PI Lawyer OS dev/demo instance)
- SSH: root / Poll0000
- Cloned from AI-OS-POC VM

---

## Open Questions (None — All Resolved)

All Phase 1 architecture decisions are locked. See `.planning/phases/01-foundation/01-CONTEXT.md`.
