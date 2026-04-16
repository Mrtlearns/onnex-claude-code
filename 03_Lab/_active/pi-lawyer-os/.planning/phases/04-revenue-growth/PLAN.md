# Phase 4 — Revenue Growth: Plan

**Created:** 2026-03-16
**Status:** Ready
**Milestone:** v2.0

---

## Scope

Adds the revenue growth layer on top of the Phase 1–3 foundation. Implements partner/referral relationship tracking, automated lost-lead resurrection sequences via n8n, a referral thank-you flywheel, and revenue share (commission) reporting. Also adds a Resurrection Queue dashboard widget and review-sourced lead conversion tracking. The n8n automation is the core of this phase — the database and frontend are relatively thin.

---

## Waves

### Wave 1: Database Schema
**Goal:** Migration 004 — `partners`, `partner_referrals` tables + lead column additions for resurrection tracking and referral linkage.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Write migration 004: `partners` table (firm_id, name, type, phone, email, address, notes, active) | `postgres/migrations/004_revenue_growth.sql` | No |
| 1.2 | Write migration 004: `partner_referrals` table (firm_id, partner_id, lead_id, case_id nullable, commission_pct, commission_amount, commission_paid, referred_at) | `postgres/migrations/004_revenue_growth.sql` | No |
| 1.3 | Write migration 004: ALTER leads — add `referred_by_partner_id` FK, `last_contact_at` TIMESTAMPTZ, `resurrection_sent_at` TIMESTAMPTZ | `postgres/migrations/004_revenue_growth.sql` | No |
| 1.4 | Write migration 004: trigger to update `leads.last_contact_at` on communications insert + RLS policies + grants on new tables | `postgres/migrations/004_revenue_growth.sql` | No |

---

### Wave 2: n8n Automation Workflows
**Goal:** Two new n8n workflows — lost lead resurrection and referral thank-you flywheel.

**Depends on:** Wave 1 complete (new DB columns required)

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Lost lead resurrection workflow — daily 9am cron, query PostgREST for leads inactive > 30 days (status in new/contacted/intake-in-progress, last_contact_at older than 30 days or null with created_at > 30 days, resurrection_sent_at null or > 30 days ago), send SMS via Twilio, log to communications, update resurrection_sent_at | `n8n/lost-lead-resurrection.json` | Yes (n8n-workflow-builder) |
| 2.2 | Referral thank-you workflow — webhook trigger on lead status → signed, check if referred_by_partner_id set, fetch partner phone/email from PostgREST, send Twilio SMS to partner: "Your referral {client_name} has retained our firm. Thank you for trusting us with your referrals.", log to communications | `n8n/referral-thankyou.json` | Yes (n8n-workflow-builder) |

---

### Wave 3: Frontend Types + Hooks
**Goal:** TypeScript types and TanStack Query hooks for partners and referrals.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Add types: `PartnerType`, `Partner`, `PartnerReferral`, `CreatePartnerInput`, `CreateReferralInput` | `frontend/src/types/index.ts` | No |
| 3.2 | `usePartners.ts` — `usePartners()` query, `usePartner(id)` query, `useCreatePartner()` mutation, `useUpdatePartner()` mutation | `frontend/src/hooks/usePartners.ts` | No |
| 3.3 | `useReferrals.ts` — `usePartnerReferrals(partnerId)` query, `useLeadReferral(leadId)` query, `useCreateReferral()` mutation, `useUpdateReferral()` mutation (mark commission paid) | `frontend/src/hooks/useReferrals.ts` | No |

---

### Wave 4: Partners Frontend — List + Detail
**Goal:** Full Partners CRUD page — list, create form, detail view with referral history and commission tracking.

**Depends on:** Wave 3 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | `Partners` page — list with columns: name, type badge, phone, total referrals, total commissions owed; "Add Partner" button; filter by type | `frontend/src/pages/Partners.tsx` | No |
| 4.2 | `PartnerDetail` page — contact info card, referral history table (lead name, referred date, signed/not signed, case_id link, commission status), commissions owed total, "Mark Paid" button per referral | `frontend/src/pages/PartnerDetail.tsx` | No |
| 4.3 | Add Partners nav link to sidebar (`/partners`) | `frontend/src/components/Layout.tsx` | No |
| 4.4 | Add `/partners` and `/partners/:id` routes to React Router config | `frontend/src/App.tsx` | No |

---

### Wave 5: Lead + Dashboard Enhancements
**Goal:** "Referred by" partner selector on LeadDetail; Resurrection Queue + Revenue Growth stats on dashboard.

**Depends on:** Waves 3 + 4 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | Update `LeadDetail` — add "Referred by" select (fetch from usePartners, shows partner name), saves to `referred_by_partner_id` via PATCH; show referral badge when set | `frontend/src/pages/LeadDetail.tsx` | No |
| 5.2 | `ResurrectionQueueWidget` component — queries leads with `last_contact_at` > 30 days ago OR (last_contact_at null AND created_at > 30 days ago), status not in signed/lost; shows count + list of first 5 leads with name, days-inactive badge, click → LeadDetail | `frontend/src/components/ResurrectionQueueWidget.tsx` | No |
| 5.3 | `ReferralStatsWidget` component — shows: total partners, referrals this month, referral-to-signed conversion rate (signed referrals / total referrals), commissions owed total | `frontend/src/components/ReferralStatsWidget.tsx` | No |
| 5.4 | Add `ResurrectionQueueWidget` and `ReferralStatsWidget` to Dashboard page (new row below existing widgets) | `frontend/src/pages/Dashboard.tsx` | No |

---

### Wave 6: Deploy + Migrate
**Goal:** Migration 004 applied, n8n workflows imported, updated frontend deployed on 10.10.110.33.

**Depends on:** Waves 1–5 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 6.1 | Upload all Phase 4 files to server, apply migration 004, restart postgrest to pick up new tables | (server commands) | No |
| 6.2 | Import lost-lead-resurrection and referral-thankyou workflows into n8n via API | (server commands) | No |
| 6.3 | Rebuild and redeploy frontend (new Partners pages + dashboard widgets) | (server commands) | No |
| 6.4 | Smoke test: create partner, link to lead, verify partner referrals table, check dashboard resurrection queue shows inactive leads | (server + browser) | No |

---

## Success Criteria

- [ ] Lost lead re-engagement sequences (n8n workflow active, sends SMS to leads inactive > 30 days)
- [ ] Partner referral tracking (partners table + referrals linked to leads and cases)
- [ ] Review-to-case conversion monitoring (review-sourced leads tracked via `source = 'review'` filter on dashboard)
- [ ] Revenue share reporting (commission % and paid/unpaid status per referral on partner detail)
- [ ] Resurrection Queue widget on dashboard showing inactive leads
- [ ] Referral Stats widget on dashboard (total partners, this-month referrals, conversion rate, commissions owed)
- [ ] "Referred by" partner linkage on lead detail

---

## Technical Specifics

### New DB Tables

```sql
CREATE TABLE partners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  partner_type TEXT NOT NULL DEFAULT 'other', -- attorney, medical, chiropractor, other
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE partner_referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id          UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  partner_id       UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  lead_id          UUID REFERENCES leads(id) ON DELETE SET NULL,
  case_id          UUID REFERENCES cases(id) ON DELETE SET NULL,
  commission_pct   NUMERIC(5,2) DEFAULT 0,       -- e.g. 33.33
  commission_amount NUMERIC(10,2) DEFAULT 0,     -- dollar amount owed
  commission_paid  BOOLEAN DEFAULT false,
  referred_at      TIMESTAMPTZ DEFAULT now(),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- New columns on leads:
ALTER TABLE leads
  ADD COLUMN referred_by_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  ADD COLUMN last_contact_at        TIMESTAMPTZ,
  ADD COLUMN resurrection_sent_at   TIMESTAMPTZ;
```

### Trigger: last_contact_at

```sql
CREATE OR REPLACE FUNCTION update_lead_last_contact() RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads SET last_contact_at = NEW.created_at
  WHERE id = NEW.lead_id AND (last_contact_at IS NULL OR NEW.created_at > last_contact_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comm_updates_lead_last_contact
  AFTER INSERT ON communications
  FOR EACH ROW EXECUTE FUNCTION update_lead_last_contact();
```

### n8n Workflows

```
lost-lead-resurrection.json
  Trigger:      Cron — every day at 9:00 AM
  Step 1:       HTTP GET /api/leads?status=in.(new,contacted,intake-in-progress)
                  &select=id,first_name,last_name,phone,last_contact_at,created_at,resurrection_sent_at
                  &or=(last_contact_at.lt.{30-days-ago},last_contact_at.is.null)
  Step 2:       Filter — exclude leads where resurrection_sent_at is within last 30 days
  Step 3:       For each lead: Twilio Send SMS
  Step 4:       For each lead: HTTP POST /api/communications (log SMS)
  Step 5:       For each lead: HTTP PATCH /api/leads?id=eq.{id} (set resurrection_sent_at = now())

referral-thankyou.json
  Trigger:      Webhook (POST from PostgREST/trigger or n8n polling)
  Condition:    Lead status changed to 'signed' AND referred_by_partner_id IS NOT NULL
  Step 1:       HTTP GET /api/partners?id=eq.{referred_by_partner_id}
  Step 2:       If partner.phone: Twilio Send SMS to partner
  Step 3:       HTTP POST /api/communications (log to lead)
```

### Service Names (Docker Compose — no new services)
All existing services. No new containers in Phase 4.

```
pilaweros-postgres     (existing — migration 004 added)
pilaweros-postgrest    (existing — restart to pick up new tables)
pilaweros-n8n          (existing — 2 new workflows imported)
pilaweros-frontend     (existing — rebuild with new pages/widgets)
```

### Frontend File Conventions

```
New pages:
  frontend/src/pages/Partners.tsx
  frontend/src/pages/PartnerDetail.tsx

New hooks:
  frontend/src/hooks/usePartners.ts
  frontend/src/hooks/useReferrals.ts

New components:
  frontend/src/components/ResurrectionQueueWidget.tsx
  frontend/src/components/ReferralStatsWidget.tsx

Updated files:
  frontend/src/types/index.ts        (Partner, PartnerReferral types)
  frontend/src/pages/LeadDetail.tsx  (referred_by_partner_id selector)
  frontend/src/pages/Dashboard.tsx   (two new widgets)
  frontend/src/components/Layout.tsx (Partners nav link)
  frontend/src/App.tsx               (two new routes)
```

### Key Commands

```bash
# Apply migration on server
docker compose exec -T postgres psql -U postgres -d pilaweros < postgres/migrations/004_revenue_growth.sql

# Restart PostgREST to pick up new tables
docker compose restart postgrest

# Import n8n workflows via n8n API
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @n8n/lost-lead-resurrection.json

# Rebuild frontend
docker compose build frontend && docker compose up -d frontend
```

### Resurrection Queue Query (PostgREST)

```
GET /api/leads
  ?status=in.(new,contacted,intake-in-progress)
  &or=(last_contact_at.lt.{iso-date-30-days-ago},and(last_contact_at.is.null,created_at.lt.{iso-date-30-days-ago}))
  &select=id,first_name,last_name,phone,status,last_contact_at,created_at
  &order=last_contact_at.asc.nullslast
```

---

## Deferred (Out of Scope for Phase 4)

- Google Reviews API monitoring (automated review scraping) — too complex, manual `source = 'review'` tagging is sufficient for Phase 4
- Neo4j graph writes for partner relationships — Neo4j exists but Phase 4 uses Postgres for partner tracking; graph queries deferred to Phase 6 analytics
- Email outreach to partners (email integration) — SMS only in Phase 4; email requires SMTP config (client onboarding step)
- Multi-step resurrection SMS sequences (Day 1, Day 7, Day 14) — Phase 4 sends one resurrection message; sequences deferred to Phase 6
- Referral commission invoice generation (PDF) — tracked in DB only; invoice generation deferred to Phase 5 (billing)
- Attorney referral split tracking (inside the firm) — tracked as partner referrals; internal splits deferred to Phase 5
- A/B testing of resurrection SMS copy — deferred
- Lead scoring integration with resurrection (skip cold leads) — use Claude lead scoring prompt in Phase 4+ workflow; deferred for now
