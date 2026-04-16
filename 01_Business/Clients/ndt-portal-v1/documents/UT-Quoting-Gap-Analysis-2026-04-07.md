# UT Quoting Engine — Gap Analysis
**Spec:** UT Quoting Engine v1 (NDT Nov 2025)
**Codebase:** NDT Portal v1
**Date:** 2026-04-07
**Author:** Onnex AI (MrT)

---

## Executive Summary

The core UT quoting engine is **substantially built**. The pricing math, Salesforce integration, database schema, and frontend calculator are all production-ready. The primary gaps are: **role-based permissions, re-quote/part history lookup, reporting, rush level / standard/spec fields, and approval workflows**. These represent Milestones 2 and 3 work rather than Milestone 1.

---

## Gap Analysis by Spec Section

### § 4.1 — Create UT Quote (Internal UI)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Customer selection (search by name) | ✅ Built | `UtCustomersTab.tsx` — 30 customers searchable |
| Part description input | ✅ Built | All 7 geometry types supported |
| Material & product form | ✅ Built | `ut.materials` table, density + class A/AA rates |
| Dimensions (thickness/diameter/length) | ✅ Built | Geometry-specific dimension inputs |
| UT method/technique | 🟡 Partial | Geometry-driven; no explicit angle beam / immersion selector |
| Coverage (full body / spot / %) | 🟡 Partial | Scan index slider (0.065"/0.125"/0.250") — not a named coverage type |
| Standard/spec (ASTM, customer spec) | ❌ Gap | No spec/standard field on quote request |
| Quantity | ✅ Built | Quantity input wired to lot charge calc |
| Rush / turnaround | ❌ Gap | No rush_level field; no rush multiplier |
| Time estimate output | ✅ Built | Scan time calculated and returned |
| Recommended price (list) | ✅ Built | `calculated_price` in response |
| Customer-specific price | ✅ Built | Per-customer rates, discounts applied |
| User price override with reason | ✅ Built | `PUT /quote/:id` with audit log |
| Save & push to Salesforce | 🟡 Partial | SF webhook integration built; no Save button from calculator UI |
| Calculation breakdown stamped | ✅ Built | `calculation_breakdown` JSON + `request_body`/`response_body` |
| Version / user / timestamp | ✅ Built | `quote_audit_log` table |

**Net:** 11/16 requirements met. Missing: standard/spec field, rush level, named technique/coverage selectors, UI Save button.

---

### § 4.2 — Create UT Quote from Salesforce

| Requirement | Status | Notes |
|-------------|--------|-------|
| SF triggers via API (POST with ID + fields) | ✅ Built | `POST /integrations/salesforce/quote` with HMAC validation |
| Engine returns price, line items, breakdown | ✅ Built | Full response body |
| Salesforce updates Opportunity fields | ✅ Built | `Pricing_Details__c`, `Price_Per__c`, `Lab_Status__c`, `Quote_Due_Date__c` |
| Custom object `UT_Quote_Request__c` | 🟡 Partial | Migration `024_sf_custom_objects.sql` exists; Salesforce-side object needs verification |

**Net:** 3/4 requirements met.

---

### § 4.3 — Re-quote Existing Part

| Requirement | Status | Notes |
|-------------|--------|-------|
| Look up by customer + part number / drawing number | ❌ Gap | `ut.incoming_quotes` stores history but no lookup UI or API |
| Pre-fill parameters from last quote | ❌ Gap | Not implemented |
| Show price history + deltas | ❌ Gap | Not implemented |
| Recalculate with new quantity / updated rules | ❌ Gap | Manual re-entry required |

**Net:** 0/4 requirements met. Data exists in DB; no retrieval UI or API endpoint.

---

### § 4.4 — Rule & Rate Management (Admin UI)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Base UT hourly rate | ✅ Built | `ut.global_settings` + Settings tab UI |
| Minimum charge per order / per part | ✅ Built | Per-customer `min_charge` + `cscan_min_charge` |
| Complexity surcharges | 🟡 Partial | Tech fee, env fee; no named "complexity" or "tight tolerance" surcharge |
| Customer discount % | ✅ Built | Per-customer rate columns |
| Customer minimums | ✅ Built | Per-customer `min_charge` |
| Rules versioned and auditable | ❌ Gap | `UT_Pricing_Rule_Set` entity from spec not implemented; no rule versioning |

**Net:** 3/6 requirements met. Rule versioning is a gap.

---

### § 4.5 — Audit & Traceability

| Requirement | Status | Notes |
|-------------|--------|-------|
| Input parameters stored | ✅ Built | `request_body` JSON in `incoming_quotes` |
| Rule set & version stored | 🟡 Partial | No rule set version; current rules at time of quote not snapshot |
| Time estimate stored | ✅ Built | `time_estimate_minutes` column |
| Price breakdown (base, surcharges, discounts) | ✅ Built | `calculation_breakdown` JSON |
| User + timestamp | ✅ Built | `created_by`, `created_at`, `quote_audit_log` |

**Net:** 4/5 requirements met.

---

### § 4.6 — Permissions (RBAC)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Role: UT Level III (can override, define rules) | ❌ Gap | Auth exists (Authentik OIDC) but no roles assigned to quote actions |
| Role: Sales (guided UI, no price invention) | ❌ Gap | No role-based UI restrictions |
| Role: Admin (manages rate tables) | ❌ Gap | Settings tab is unprotected |
| Role: Management (reporting) | ❌ Gap | No reporting views |
| Price override > ±20% requires manager approval | ❌ Gap | Override accepted without approval workflow |

**Net:** 0/5 requirements met. Auth infrastructure exists but RBAC is not wired to quote actions.

---

### § 5 — Pricing Logic

| Requirement | Status | Notes |
|-------------|--------|-------|
| T_setup by part size / technique / new vs repeat | 🟡 Partial | Load time defaults per geometry; no new-vs-repeat distinction |
| T_scan per geometry (7 types) | ✅ Built | All 7: FLAT_BAR, ROUND_BAR, RING, TUBING, CSCAN_FLAT, CSCAN_ROUND, THIN_SHEET |
| T_handling per piece | ✅ Built | Load time per geometry |
| T_report by standard | ❌ Gap | No reporting time component |
| Rush multiplier | ❌ Gap | No rush_level → price multiplier |
| Customer discount / target margin | ✅ Built | Per-customer rates |
| 1:1 spreadsheet match validation | ❌ Gap | No test suite against Jonathan's historical quotes |

**Net:** 3/7 requirements met. Reporting time and rush multiplier are missing formula components.

---

### § 6 — Data Model

| Entity | Status | Notes |
|--------|--------|-------|
| Customer | ✅ Built | `ut.customers` — 30 rows, all key fields present |
| UT_Quote_Request | ✅ Built | `ut.incoming_quotes` covers this |
| UT_Quote | ✅ Built | `ut.quotes` + `ut.line_items` |
| UT_Pricing_Rule_Set | ❌ Gap | Not implemented; rules are flat columns on customer rows |
| User | 🟡 Partial | Authentik-managed; no local `users` table with role enum |

**Net:** 3/5 entities built.

---

### § 7 — Architecture

| Component | Status | Notes |
|-----------|--------|-------|
| UT Quoting Service (REST API) | ✅ Built | Express API, port 3100 |
| Web UI (New Quote, Quote List, Rules) | 🟡 Partial | Calculator + Customers + Settings + Quote History; no re-quote from history |
| Salesforce integration (Option A) | ✅ Built | Webhook + writeback |
| Email integration | ✅ Built | WF-1 n8n workflow (IMAP → LLM extract → API) |

---

### § 8 — User Flows

| Flow | Status | Notes |
|------|--------|-------|
| Flow 1: Sales creates quote in internal UI | 🟡 Partial | Calculator works; no Save & Push to SF button from calculator |
| Flow 2: Quote from Salesforce button | ✅ Built | Webhook → engine → writeback complete |

---

### § 9 — Testing & Validation

| Requirement | Status | Notes |
|-------------|--------|-------|
| Historical quote test set (±1% match) | ❌ Gap | No test suite against Jonathan's spreadsheet |
| UAT with Jonathan & Selene | ❌ Gap | Not started |

---

### § 10 — Phased Delivery

| Milestone | Status | Notes |
|-----------|--------|-------|
| M1: Backend + calculation engine + CLI/form UI | ✅ Complete | Calculator UI, API, DB, 30 customers |
| M2: Full internal web UI + RBAC + logging | 🟡 Partial | UI exists; RBAC missing; re-quote missing |
| M3: Salesforce integration + reporting + quote history | 🟡 Partial | SF integration done; reporting not started; re-quote not started |

---

## Prioritized Gap Summary

### Critical (blocks production handoff)

| Gap | Spec Ref | Effort |
|-----|----------|--------|
| Standard/spec field on quote | §4.1, §5 | Small |
| Rush level + rush multiplier | §4.1, §5 | Small |
| Save & Push to SF from calculator UI | §8 Flow 1 | Small |

### Important (Milestone 2 completion)

| Gap | Spec Ref | Effort |
|-----|----------|--------|
| Re-quote / part history lookup | §4.3 | Medium |
| RBAC wired to quote actions | §4.6 | Medium |
| Price override approval workflow (±20% threshold) | §4.6 | Medium |
| Rule versioning (`UT_Pricing_Rule_Set`) | §4.4 | Large |

### Nice-to-have (Milestone 3)

| Gap | Spec Ref | Effort |
|-----|----------|--------|
| Reporting time component in pricing formula | §5 | Small |
| Reporting / metrics dashboard | §4.6, §3 | Large |
| 1:1 spreadsheet validation test suite | §9 | Medium |
| Email reply-back with quote | §4.2 | Medium |
| SF `UT_Quote_Request__c` deployment verification | §4.2 | Small |

---

## What Can Ship Now

The engine is **demo-able and functionally complete** for **Flow 2 (Salesforce → quote → writeback)**. It can process live quotes from Salesforce today.

The internal UI calculator works end-to-end: calculate → print. The Quote History page (`/quotes`) shows all saved quotes with full detail modal, PDF download/preview, status editing, and audit log.

**Gap:** Calculator has no Save button — a quote must come in via SF webhook, email, or API to appear in Quote History.

**Recommended next sprint:** Rush field + standard/spec field + "Save Quote" button in calculator + PDF branding upgrade with logo. That closes the most visible Flow 1 gap and makes the portal fully self-contained for Selene's team.

---

## What's Already Built (Key Strengths)

| Area | Detail |
|------|--------|
| **Core calculation** | 7 geometry types, weight-based pricing, per-customer rates/fees/minimums |
| **Quote History UI** | Full modal with PDF preview/download, editing, status lifecycle, audit trail |
| **Salesforce integration** | Webhook + writeback complete (`Pricing_Details__c`, `Price_Per__c`, `Lab_Status__c`) |
| **Email intake** | n8n WF-1 reads IMAP → Claude LLM extracts fields → API |
| **PDF generation** | Gotenberg service integrated; POST /quote/:id/pdf + GET /quote/:id/pdf both wired |
| **Audit trail** | `quote_audit_log` + `request_body`/`response_body` JSON on every quote |
| **30 customer profiles** | All with per-customer rates, env fee, tech fee, delivery fee, lead time, notes |
| **PostgREST** | Full `ut` schema exposed as REST API for admin operations |
