# Phase 5 — Billing + Finance: Plan

**Created:** 2026-03-16
**Status:** Ready
**Milestone:** v2.1

---

## Scope

Adds the financial layer to case management. Implements a settlement negotiation log (offer/counter history), a fee ledger for cost tracking (medical liens, filing fees, expert costs), and a disbursement calculator that computes attorney fee, cost deductions, and net to client from the gross settlement. Produces a printable settlement summary report per case.

---

## Waves

### Wave 1: Database Schema
**Goal:** Migration 005 — `settlement_offers`, `case_costs`, `case_settlements` tables. Add `attorney_fee_pct` to cases.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Write migration 005: `settlement_offers` table (firm_id, case_id, offer_by `defense`/`plaintiff`, amount, offered_at, notes, accepted bool) | `postgres/migrations/005_billing_finance.sql` | No |
| 1.2 | Write migration 005: `case_costs` table (firm_id, case_id, cost_type enum, description, amount, paid bool, paid_at, provider_id FK to medical_providers nullable) | `postgres/migrations/005_billing_finance.sql` | No |
| 1.3 | Write migration 005: `case_settlements` table (firm_id, case_id UNIQUE, gross_settlement, attorney_fee_pct, attorney_fee_amount GENERATED, costs_total, net_to_client GENERATED, settled_at, notes) | `postgres/migrations/005_billing_finance.sql` | No |
| 1.4 | Write migration 005: ALTER TABLE cases ADD COLUMN attorney_fee_pct NUMERIC(5,2) DEFAULT 33.33. RLS policies + GRANT web_user on all 3 new tables. firm_id JWT DEFAULT on all 3 tables. | `postgres/migrations/005_billing_finance.sql` | No |

---

### Wave 2: Frontend Types + Hooks
**Goal:** TypeScript types and TanStack Query hooks for all three billing entities.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Add types: `OfferBy`, `CostType`, `SettlementOffer`, `CaseCost`, `CaseSettlement`, `CreateSettlementOfferInput`, `CreateCaseCostInput`, `CreateCaseSettlementInput` | `frontend/src/types/index.ts` | No |
| 2.2 | `useSettlementOffers.ts` — `useSettlementOffers(caseId)`, `useCreateSettlementOffer()`, `useUpdateSettlementOffer()` | `frontend/src/hooks/useSettlementOffers.ts` | No |
| 2.3 | `useCaseCosts.ts` — `useCaseCosts(caseId)`, `useCreateCaseCost()`, `useUpdateCaseCost()`, `useDeleteCaseCost()` | `frontend/src/hooks/useCaseCosts.ts` | No |
| 2.4 | `useCaseSettlement.ts` — `useCaseSettlement(caseId)`, `useCreateCaseSettlement()`, `useUpdateCaseSettlement()` | `frontend/src/hooks/useCaseSettlement.ts` | No |

---

### Wave 3: Settlement Negotiation Panel
**Goal:** Per-case settlement offer/counter log with negotiation history and accepted offer tracking.

**Depends on:** Wave 2 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | `SettlementPanel.tsx` — offer log table (date, party badge defense/plaintiff, amount formatted, notes, accepted checkbox); "Add Offer" inline form (offer_by select, amount input, date, notes); accepted offer highlighted; sorted newest-first | `frontend/src/components/SettlementPanel.tsx` | No |

---

### Wave 4: Fee Ledger
**Goal:** Per-case cost line items with type categorization, paid tracking, and running totals.

**Depends on:** Wave 2 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | `FeeLedgerPanel.tsx` — cost table (type badge, description, amount, paid checkbox, paid_at date); "Add Cost" form (cost_type select, description, amount, provider_id optional); footer row: total costs, total liens, total unpaid; "Sync to Calculator" button that updates case_settlements.costs_total | `frontend/src/components/FeeLedgerPanel.tsx` | No |

---

### Wave 5: Disbursement Calculator + Summary Report
**Goal:** Gross → attorney fee → costs → net-to-client calculator; printable settlement summary.

**Depends on:** Waves 3 + 4 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | `DisbursementPanel.tsx` — input fields: gross settlement, attorney fee % (default from cases.attorney_fee_pct); calculated display: attorney fee amount, costs deducted (from case_settlements.costs_total), net to client; "Save Settlement" button (POST/PATCH case_settlements); locked read-only view when settlement saved; "Edit" button to unlock | `frontend/src/components/DisbursementPanel.tsx` | No |
| 5.2 | `SettlementSummaryPanel.tsx` — read-only printable summary: case header (number, type, client name, assigned attorney), negotiation table (all offers/counters), cost breakdown table, disbursement breakdown (gross / fee / costs / net), settled_at date, notes; "Print" button (calls `window.print()`) | `frontend/src/components/SettlementSummaryPanel.tsx` | No |

---

### Wave 6: CaseDetail Integration + Deploy
**Goal:** Wire all 4 billing panels into CaseDetail as new tabs; deploy migration + frontend on 10.10.110.33.

**Depends on:** Waves 3–5 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 6.1 | Update `CaseDetail.tsx` — add "Billing" tab section with 4 panels: SettlementPanel, FeeLedgerPanel, DisbursementPanel, SettlementSummaryPanel; show settlement amount badge on case header when settlement exists | `frontend/src/pages/CaseDetail.tsx` | No |
| 6.2 | Upload all Phase 5 files to server, apply migration 005, restart postgrest | (server commands) | No |
| 6.3 | Rebuild and redeploy frontend | (server commands) | No |
| 6.4 | Smoke test: POST /api/settlement_offers, POST /api/case_costs, POST /api/case_settlements; verify GENERATED columns compute correctly; verify frontend loads billing tab on case detail | (server commands) | No |

---

## Success Criteria

- [ ] Settlement offer/counter tracker (log with party, amount, date, accepted flag)
- [ ] Disbursement calculator (gross settlement → attorney fee % → costs → net to client)
- [ ] Fee ledger (cost line items with type, amount, paid status, running totals)
- [ ] Settlement summary report (printable per-case full breakdown)
- [ ] All 4 panels visible on CaseDetail under "Billing" tab
- [ ] GENERATED columns compute correctly (attorney_fee_amount, net_to_client)

---

## Technical Specifics

### New DB Tables

```sql
CREATE TABLE settlement_offers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  offer_by     TEXT NOT NULL DEFAULT 'defense', -- 'defense' | 'plaintiff'
  amount       NUMERIC(12,2) NOT NULL,
  offered_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  accepted     BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE case_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  cost_type    TEXT NOT NULL DEFAULT 'other',  -- 'medical_lien' | 'filing_fee' | 'expert_fee' | 'investigation' | 'other'
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  paid         BOOLEAN DEFAULT false,
  paid_at      DATE,
  provider_id  UUID REFERENCES medical_providers(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE case_settlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id             UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  gross_settlement    NUMERIC(12,2) NOT NULL,
  attorney_fee_pct    NUMERIC(5,2) NOT NULL DEFAULT 33.33,
  attorney_fee_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(gross_settlement * attorney_fee_pct / 100, 2)
  ) STORED,
  costs_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_to_client       NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(gross_settlement - (gross_settlement * attorney_fee_pct / 100) - costs_total, 2)
  ) STORED,
  settled_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Add default fee pct to cases
ALTER TABLE cases ADD COLUMN attorney_fee_pct NUMERIC(5,2) DEFAULT 33.33;
```

### GENERATED Column Note

PostgREST treats `GENERATED ALWAYS AS ... STORED` columns as read-only — correct behavior. Clients send `gross_settlement`, `attorney_fee_pct`, `costs_total`; the DB computes `attorney_fee_amount` and `net_to_client`. No computed logic needed on the frontend.

### Service Names (Docker Compose — no new services)

```
pilaweros-postgres     (migration 005 added)
pilaweros-postgrest    (restart to pick up new tables)
pilaweros-frontend     (rebuild with new panels)
```

### Frontend File Conventions

```
New components:
  frontend/src/components/SettlementPanel.tsx
  frontend/src/components/FeeLedgerPanel.tsx
  frontend/src/components/DisbursementPanel.tsx
  frontend/src/components/SettlementSummaryPanel.tsx

New hooks:
  frontend/src/hooks/useSettlementOffers.ts
  frontend/src/hooks/useCaseCosts.ts
  frontend/src/hooks/useCaseSettlement.ts

Updated files:
  frontend/src/types/index.ts        (new billing types)
  frontend/src/pages/CaseDetail.tsx  (Billing tab section)
```

### Key Commands

```bash
# Apply migration on server
docker compose exec -T postgres psql -U postgres -d pilaweros < postgres/migrations/005_billing_finance.sql

# Restart PostgREST
docker compose restart postgrest

# Rebuild frontend
docker compose build frontend && docker compose up -d frontend
```

### Cost Types

| Value | Label |
|-------|-------|
| `medical_lien` | Medical Lien |
| `filing_fee` | Filing Fee |
| `expert_fee` | Expert Fee |
| `investigation` | Investigation |
| `other` | Other |

### Offer Party Types

| Value | Label |
|-------|-------|
| `defense` | Defense |
| `plaintiff` | Plaintiff |

---

## Deferred (Out of Scope for Phase 5)

- Invoice PDF generation (Phase 6)
- Attorney split tracking between firm attorneys (separate ledger feature)
- Insurance subrogation tracking (too complex for Phase 5; tracked manually via case notes)
- QuickBooks / accounting system export (Phase 6+)
- Client-facing disbursement statement sent via portal (Phase 6 — client portal)
- Multi-case settlement grouping (class action patterns) — not applicable to PI
- Automated lien reduction negotiation tracking — tracked as cost line items only
