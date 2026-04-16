# Phase 6 — Client Portal + Analytics: Plan

**Created:** 2026-03-16
**Status:** Ready
**Milestone:** v2.2

---

## Scope

Delivers the final two product modules. The **Client Portal** gives external clients a limited login to view their case status, timeline, and staff-shared documents — no staff tools exposed. The **Analytics Dashboard** gives firm owners revenue KPIs, case value breakdowns, settlement rates, and referral attribution charts from existing data. Together these complete the full PI Lawyer OS product.

---

## Waves

### Wave 1: Database Schema
**Goal:** Migration 006 — `client_users` table, `shared_with_client` on documents, `client_user` Postgres role, analytics views.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Write migration 006: `client_users` table (firm_id, client_id FK to clients, email UNIQUE per firm, password_hash, active, created_at) | `postgres/migrations/006_portal_analytics.sql` | No |
| 1.2 | Write migration 006: `ALTER TABLE documents ADD COLUMN shared_with_client BOOLEAN DEFAULT false`. `client_user` Postgres role: GRANT SELECT on cases, documents, clients, communications, case_settlements, case_costs to client_user. RLS policies for client_user on each table using `client_id` JWT claim | `postgres/migrations/006_portal_analytics.sql` | No |
| 1.3 | Write migration 006: Analytics views — `v_analytics_case_summary` (total cases, by status, avg settlement), `v_analytics_lead_funnel` (leads by status, conversion rates), `v_analytics_referral_attribution` (leads + signed by source), `v_analytics_partner_performance` (referrals + conversion per partner) | `postgres/migrations/006_portal_analytics.sql` | No |
| 1.4 | Write migration 006: GRANT SELECT on all analytics views to web_user. firm_id JWT DEFAULT on client_users | `postgres/migrations/006_portal_analytics.sql` | No |

---

### Wave 2: Auth Service — Portal Login
**Goal:** Add client portal login endpoint to the auth FastAPI service. Issues JWT with `role=client_user`, `firm_id`, and `client_id`.

**Depends on:** Wave 1 complete (client_users table)

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Add `POST /portal-login` endpoint: accepts `{firm_slug, email, password}`, verifies against `client_users`, returns JWT `{role:'client_user', firm_id, client_id}` with 24h expiry. Add `POST /portal-register` endpoint: staff endpoint (web_user JWT required) to create a client portal account for a client_id | `auth/main.py` | No |

---

### Wave 3: Frontend Types + Portal Hooks
**Goal:** TypeScript types and TanStack Query hooks for portal auth and client case access.

**Depends on:** Wave 2 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Add types: `ClientUser`, `PortalSession`, `PortalCase`, `CreateClientUserInput` | `frontend/src/types/index.ts` | No |
| 3.2 | `usePortalAuth.ts` — `usePortalLogin()` mutation (POST /auth/portal-login), stores portal JWT in localStorage under `plo_portal_token`, `usePortalSession()` (decode JWT to get client_id/firm_id), `portalLogout()` | `frontend/src/hooks/usePortalAuth.ts` | No |
| 3.3 | `usePortalCase.ts` — `usePortalCaseData(caseId)` query (uses portal JWT), `usePortalDocuments(caseId)` query (shared_with_client=eq.true filter), `usePortalCommunications(leadId)` query (note channel only — staff notes visible to client) | `frontend/src/hooks/usePortalCase.ts` | No |

---

### Wave 4: Client Portal Pages + Staff Share Toggle
**Goal:** Portal login page, client dashboard, protected portal routes. Staff "Share with client" checkbox on documents.

**Depends on:** Wave 3 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | `PortalLogin.tsx` — standalone login page at `/portal/login`; `firm_slug` + `email` + `password` fields; uses `usePortalLogin()`; redirects to `/portal` on success; styled cleanly (separate from staff login) | `frontend/src/pages/PortalLogin.tsx` | No |
| 4.2 | `ClientPortal.tsx` — protected portal page at `/portal`; case status badge; timeline (staff notes visible to client, newest first); shared documents list (download link); "Powered by PI Lawyer OS" footer; reads case_id from portal JWT claims | `frontend/src/pages/ClientPortal.tsx` | No |
| 4.3 | Add portal routes to `App.tsx`: `/portal/login` → `<PortalLogin>` (public); `/portal` → portal auth guard → `<ClientPortal>` (requires portal JWT). Portal auth guard checks `plo_portal_token` in localStorage | `frontend/src/App.tsx` | No |
| 4.4 | Add "Share with client" toggle to `DocumentPanel.tsx` — checkbox per document row that PATCHes `shared_with_client` boolean; shows client icon badge on shared docs. Add "Create Portal Access" button to CaseDetail overview tab — opens mini form: client email + temp password → calls `POST /auth/portal-register` | `frontend/src/components/DocumentPanel.tsx`, `frontend/src/pages/CaseDetail.tsx` | No |

---

### Wave 5: Analytics Dashboard
**Goal:** Analytics page with revenue KPIs, case funnel, settlement breakdown, referral attribution — all via analytics views.

**Depends on:** Wave 1 complete (analytics views), Wave 3 complete (web_user hooks pattern)

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | `useAnalytics.ts` — hooks for all 4 analytics views: `useAnalyticsCaseSummary()`, `useAnalyticsLeadFunnel()`, `useAnalyticsReferralAttribution()`, `useAnalyticsPartnerPerformance()` | `frontend/src/hooks/useAnalytics.ts` | No |
| 5.2 | `Analytics.tsx` page — KPI row: total cases, total settlements value, avg settlement, settlement rate; Lead Funnel bar chart (Recharts BarChart — new/contacted/signed/lost counts); Settlement by Case Type bar chart; Referral Attribution table (source, leads, signed, rate %); Partner Performance table (name, referrals, signed, commissions owed) | `frontend/src/pages/Analytics.tsx` | No |
| 5.3 | Add Analytics nav link to sidebar (BarChart2 icon, `/analytics`) + add `/analytics` route to `App.tsx` | `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/App.tsx` | No |

---

### Wave 6: Deploy + Migrate
**Goal:** Migration 006 applied, auth service rebuilt, frontend deployed on 10.10.110.33. Smoke test portal login + analytics API.

**Depends on:** Waves 1–5 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 6.1 | Upload all Phase 6 files to server; apply migration 006; restart postgrest | (server commands) | No |
| 6.2 | Rebuild and redeploy auth service (new portal-login endpoint) | (server commands) | No |
| 6.3 | Rebuild and redeploy frontend | (server commands) | No |
| 6.4 | Smoke test: GET /api/v_analytics_lead_funnel → 200; POST /auth/portal-login → JWT; GET /portal page loads; documents shared_with_client column exists | (server commands) | No |

---

## Success Criteria

- [ ] Client portal with case status + document access (external client login, limited JWT)
- [ ] Analytics dashboard (case values, settlement rates, referral attribution)
- [ ] Staff can share documents with client via toggle
- [ ] Staff can create portal access accounts for clients
- [ ] Lead funnel KPI chart on analytics page
- [ ] Partner performance table on analytics page

---

## Technical Specifics

### Client Portal Auth Flow

```
Client → POST /auth/portal-login {firm_slug, email, password}
       ← JWT {role:'client_user', firm_id:'...', client_id:'...', exp:24h}

Client → GET /api/cases?client_id=eq.{client_id}
         Header: Authorization: Bearer {portal_jwt}
       ← [case record] (RLS: client_user can SELECT WHERE client_id = jwt.client_id)

Client → GET /api/documents?case_id=eq.{case_id}&shared_with_client=eq.true
       ← [shared documents only]
```

### New DB Tables

```sql
CREATE TABLE client_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(firm_id, email)
);
```

### New Postgres Role

```sql
CREATE ROLE client_user NOLOGIN;
-- RLS policies for client_user check:
-- current_setting('request.jwt.claims', true)::json->>'client_id'
-- cases: WHERE client_id = jwt.client_id AND firm_id = jwt.firm_id
-- documents: WHERE case_id IN (SELECT id FROM cases WHERE client_id = jwt.client_id) AND shared_with_client = true
-- communications: WHERE lead_id IN (SELECT lead_id FROM cases WHERE client_id = jwt.client_id) AND channel = 'note'
-- clients: WHERE id = jwt.client_id
-- case_settlements: WHERE case_id IN (SELECT id FROM cases WHERE client_id = jwt.client_id)
-- case_costs: WHERE case_id IN (SELECT id FROM cases WHERE client_id = jwt.client_id)
```

### Analytics Views

```sql
-- Case summary (firm-scoped)
CREATE VIEW v_analytics_case_summary AS
SELECT firm_id,
  COUNT(*) AS total_cases,
  COUNT(*) FILTER (WHERE status='closed') AS closed_cases,
  COUNT(*) FILTER (WHERE status='settlement') AS settled_cases,
  COALESCE(AVG(cs.gross_settlement), 0) AS avg_settlement,
  COALESCE(SUM(cs.gross_settlement), 0) AS total_settlement_value
FROM cases c
LEFT JOIN case_settlements cs ON cs.case_id = c.id
GROUP BY firm_id;

-- Lead funnel
CREATE VIEW v_analytics_lead_funnel AS
SELECT firm_id, status, COUNT(*) AS count
FROM leads GROUP BY firm_id, status;

-- Referral attribution (source → leads, signed)
CREATE VIEW v_analytics_referral_attribution AS
SELECT firm_id, source,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE status='signed') AS signed_leads,
  ROUND(COUNT(*) FILTER (WHERE status='signed')::NUMERIC / NULLIF(COUNT(*),0) * 100, 1) AS conversion_pct
FROM leads GROUP BY firm_id, source;

-- Partner performance
CREATE VIEW v_analytics_partner_performance AS
SELECT p.firm_id, p.id AS partner_id, p.name,
  COUNT(pr.id) AS total_referrals,
  COUNT(l.id) FILTER (WHERE l.status='signed') AS signed_referrals,
  COALESCE(SUM(pr.commission_amount) FILTER (WHERE NOT pr.commission_paid), 0) AS commissions_owed
FROM partners p
LEFT JOIN partner_referrals pr ON pr.partner_id = p.id
LEFT JOIN leads l ON l.id = pr.lead_id
GROUP BY p.firm_id, p.id, p.name;
```

### Service Names (Docker Compose)

```
pilaweros-postgres   (migration 006 added)
pilaweros-postgrest  (restart — new tables + views + client_user role)
pilaweros-auth       (rebuild — new portal-login endpoint)
pilaweros-frontend   (rebuild — analytics page + portal pages)
```

### Frontend File Conventions

```
New pages:
  frontend/src/pages/PortalLogin.tsx
  frontend/src/pages/ClientPortal.tsx
  frontend/src/pages/Analytics.tsx

New hooks:
  frontend/src/hooks/usePortalAuth.ts
  frontend/src/hooks/usePortalCase.ts
  frontend/src/hooks/useAnalytics.ts

Updated files:
  frontend/src/types/index.ts          (ClientUser, PortalSession, PortalCase types)
  frontend/src/App.tsx                 (portal routes + analytics route)
  frontend/src/components/layout/Sidebar.tsx  (Analytics nav link)
  frontend/src/components/DocumentPanel.tsx   (shared_with_client toggle)
  frontend/src/pages/CaseDetail.tsx    (Create Portal Access button on overview tab)
  auth/main.py                         (portal-login + portal-register endpoints)
```

### Key Commands

```bash
# Apply migration
docker compose exec -T postgres psql -U postgres -d pilaweros < postgres/migrations/006_portal_analytics.sql

# Rebuild auth
docker compose build auth && docker compose up -d auth

# Rebuild frontend
docker compose build frontend && docker compose up -d frontend

# Restart postgrest (pick up new role + views)
docker compose restart postgrest

# Test analytics view
curl http://10.10.110.33/api/v_analytics_lead_funnel \
  -H "Authorization: Bearer $JWT"

# Test portal login
curl -X POST http://10.10.110.33/auth/portal-login \
  -H "Content-Type: application/json" \
  -d '{"firm_slug":"demo","email":"client@example.com","password":"test"}'
```

### Portal localStorage Key

```
plo_portal_token — portal JWT (separate from staff plo_token)
```

---

## Deferred (Out of Scope for Phase 6)

- Multi-firm admin view (Onnex oversight across all clients) — requires super-admin JWT bypass of firm_id RLS; deferred to v3.0 admin console
- Client portal mobile app — PWA/native; deferred
- Client portal document upload (client submitting their own docs) — staff-only upload in Phase 6
- Real-time case status push notifications (WebSocket / SSE) — polling only in Phase 6
- Analytics export to CSV/PDF — deferred
- Google Analytics integration — deferred
- Settlement comparison against market benchmarks — requires external data; deferred
- Lead scoring ML model — Claude-based scoring via AI service; deferred to Phase 6.1
- Twilio Conversations integration (two-way client SMS portal) — deferred
- Stripe billing integration for Onnex invoicing clients — separate Onnex ops product
