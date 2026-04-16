# Phase 1 — Revenue Protection: Context

> **Status:** Architecture locked — ready to plan and build.

---

## What Phase 1 Builds

The Revenue Protection module — the sales wedge for PI Lawyer OS. Solves the #1 measurable pain: PI firms lose cases because they're slow to respond to leads and miss calls.

**Deliverables:**
1. Multi-tenant Docker stack (firms, leads, communications)
2. Lead ingestion (web form + Twilio inbound)
3. Speed-to-lead automation (< 2 min SMS via n8n)
4. Missed call recovery (SMS → 2h wait → follow-up SMS via n8n)
5. Intake completion + retainer follow-up sequences
6. Unified lead timeline UI
7. Response time + recovery rate dashboard

---

## Tech Stack (Locked)

### Frontend
| Component | Version / Package | Notes |
|-----------|------------------|-------|
| Framework | React 18 + TypeScript | Strict mode |
| Build tool | Vite | Fast dev, optimized prod |
| UI library | Tailwind CSS + shadcn/ui | Component library on top of Tailwind |
| Animations | Framer Motion | Dashboard transitions, timeline |
| Data fetching | TanStack Query v5 | Server state, caching, mutations |
| Forms | React Hook Form + Zod | Validated lead intake form |
| Charts | Recharts | KPI dashboard cards |

### Backend
| Component | Choice | Notes |
|-----------|--------|-------|
| Database | PostgreSQL 15 | Primary data store |
| API | PostgREST | Auto-REST from schema; no custom backend code in Phase 1 |
| Embeddings | pgvector (1536-dim) | AI similarity search extension in Postgres |
| Graph DB | Neo4j | Phase 1: Lead→Partner, Lead→Case, Case→Attorney |

### Automation + Comms
| Component | Choice | Notes |
|-----------|--------|-------|
| Workflow engine | n8n (self-hosted) | Speed-to-lead, missed call, reminders |
| SMS + Voice | Twilio | All outbound SMS; inbound missed call webhook |
| AI | Claude API (claude-sonnet-4-6) | Phase 1: intake summaries, lead scoring |

### Auth
| Component | Choice | Notes |
|-----------|--------|-------|
| Auth model | JWT | Simple, custom. Authentik deferred to v2. |
| Scoping | firm_id in JWT payload | All queries scoped to firm |
| Roles | admin, attorney, paralegal | Per firm |

### Infrastructure
| Component | Choice | Notes |
|-----------|--------|-------|
| Deployment | Docker Compose | Per-client instance model |
| Reverse proxy | Traefik | TLS + routing |
| Target server | 10.10.110.33 | PI Lawyer OS dev/demo VM (root/Poll0000) |
| CI/CD | GitLab CI → ndtv1 runner | Auto-deploy on push to main |

---

## Multi-Tenant Design

`firm_id` (UUID) is present on all core tables. PostgREST uses JWT claims to enforce row-level filtering. Every query includes `firm_id = current_firm()`.

```sql
-- All core tables follow this pattern:
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  -- ... other fields
);
```

---

## Database Schema (Phase 1 Tables)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  injury_type TEXT,
  source TEXT,                          -- web-form, phone, sms, referral
  status TEXT DEFAULT 'new',            -- new, contacted, intake-in-progress, signed, lost
  embedding vector(1536),               -- for AI similarity search
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  firm_id UUID NOT NULL REFERENCES firms(id),
  channel TEXT NOT NULL,                -- sms, call, email, note
  direction TEXT,                       -- inbound, outbound
  message TEXT,
  status TEXT,                          -- sent, delivered, failed
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Phase 2 tables** (cases, clients, attorneys, documents, tasks) are added in Phase 2 — do not build in Phase 1.

---

## Neo4j Schema (Phase 1 Nodes)

```cypher
// Nodes
(:Lead {id, firm_id, name, phone, status})
(:Attorney {id, firm_id, name, email})
(:Partner {id, firm_id, name, type})   // referral partners
(:Case {id, firm_id, case_number})

// Relationships (Phase 1)
(l:Lead)-[:REFERRED_BY]->(p:Partner)
(l:Lead)-[:ASSIGNED_TO]->(a:Attorney)

// Relationships (Phase 2 — when cases are added)
(l:Lead)-[:BECAME]->(c:Case)
(c:Case)-[:HANDLED_BY]->(a:Attorney)
```

---

## n8n Workflows (Phase 1)

### Speed-to-Lead
- Trigger: POST to n8n webhook when lead created in Postgres
- Step 1: Send SMS via Twilio within 2 minutes
- Step 2: Notify intake team (internal channel)
- Step 3: Log communication to `communications` table via PostgREST

### Missed Call Recovery
- Trigger: Twilio missed call webhook → n8n
- Step 1: Send immediate SMS ("We missed your call, we'll call you right back...")
- Step 2: Wait 2 hours
- Step 3: If no lead response → send follow-up SMS
- Step 4: Log both communications

### Intake Completion Reminder
- Trigger: Scheduled — every hour, check leads in `intake-in-progress` status > 24h
- Action: Send SMS reminder (max 3 attempts)

### Retainer Follow-Up
- Trigger: Scheduled — daily, check leads in `contacted` status > 48h
- Action: SMS sequence (Day 2, Day 5, Day 10) — stop when signed or lost

---

## Docker Compose Services (Phase 1)

```
services:
  traefik        — reverse proxy + TLS
  frontend       — React 18 Vite build served via nginx
  postgres       — PostgreSQL 15 with pgvector
  postgrest      — REST API auto-generated from schema
  n8n            — workflow automation (port 5678)
  neo4j          — graph database (port 7474/7687)
```

---

## Service Ports (internal)

| Service | Internal Port | Exposed Via |
|---------|--------------|-------------|
| frontend | 80 | Traefik |
| postgrest | 3000 | Traefik (API subdomain) |
| n8n | 5678 | Traefik (n8n subdomain) |
| neo4j browser | 7474 | Internal only |
| neo4j bolt | 7687 | Internal only |
| postgres | 5432 | Internal only |

---

## Code Conventions (locked for all downstream phases)

- **File naming:** kebab-case for files, PascalCase for React components
- **API calls:** all through TanStack Query hooks in `src/hooks/`
- **Components:** shadcn/ui base, extended in `src/components/ui/`
- **Pages:** `src/pages/` — one file per route
- **Types:** `src/types/` — shared TypeScript interfaces
- **Forms:** React Hook Form + Zod schema validation
- **firm_id:** never hardcoded — always from JWT context via `useFirm()` hook
- **Env vars:** all secrets in `.env` — never committed

---

## Deferred (NOT in Phase 1)

- Case management UI (Phase 2)
- Document upload/AI (Phase 3)
- Revenue growth automation (Phase 4)
- Settlement/billing (Phase 5)
- Client portal (Phase 6)
- Authentik SSO (deferred to v2)
- Mobile-first responsive (Phase 1 is desktop-first)
- Multi-region deployment (single VM per client for now)
