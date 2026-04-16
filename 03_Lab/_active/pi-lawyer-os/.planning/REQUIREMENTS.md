# PI Lawyer OS — Requirements

> **Status:** v0 complete — tech stack and phase structure locked. Phase 1 ready to build.

---

## Phase 1 — Revenue Protection

> **Build timeline:** Weeks 1–4 | **Milestone:** v1.0

### Multi-Tenant Foundation
- [ ] `firms` table as root tenant entity
- [ ] `firm_id` scoped on all core tables (leads, communications, cases, attorneys)
- [ ] JWT-based auth with firm context in token payload
- [ ] User roles: admin, attorney, paralegal (per firm)

### Lead Ingestion
- [ ] Lead creation via web form (embedded on firm's intake page)
- [ ] Lead creation via phone/SMS webhook (Twilio inbound)
- [ ] Lead fields: first name, last name, phone, email, injury type, source, status
- [ ] Lead status lifecycle: new → contacted → intake-in-progress → signed → lost
- [ ] Duplicate detection (same phone or email within firm)

### Speed-to-Lead Automation (n8n)
- [ ] Trigger: new lead created → n8n webhook
- [ ] Action 1: send SMS to lead within 2 minutes (Twilio)
- [ ] Action 2: notify intake team (internal alert)
- [ ] Log communication to `communications` table
- [ ] Dashboard KPI: average response time (target < 2 min)

### Missed Call Recovery (n8n)
- [ ] Trigger: missed call event from Twilio
- [ ] Action 1: send immediate SMS to caller ("We missed your call...")
- [ ] Wait: 2 hours
- [ ] Action 2: send follow-up SMS if no response
- [ ] Dashboard KPI: missed call recovery rate (target > 40%)

### Intake Completion Reminders (n8n)
- [ ] Trigger: lead in `intake-in-progress` status for > 24h
- [ ] Action: send SMS reminder to complete intake
- [ ] Max 3 reminders before marking lead as unresponsive

### Retainer Follow-Up (n8n)
- [ ] Trigger: lead in `contacted` status for > 48h with no retainer
- [ ] Action: send follow-up SMS sequence (Day 2, Day 5, Day 10)
- [ ] Stop sequence when lead status changes to `signed` or `lost`

### Unified Lead Timeline
- [ ] Per-lead timeline view: all communications, status changes, notes in chronological order
- [ ] Manual note entry by staff
- [ ] Communication log auto-populated from n8n workflow events

### Response Time Dashboard
- [ ] KPI card: average speed-to-lead response time (target < 2 min)
- [ ] KPI card: missed call recovery rate (target > 40%)
- [ ] KPI card: leads by status
- [ ] KPI card: intake completion rate
- [ ] Lead list with sortable columns (date, status, response time, attorney)

---

## Phase 2 — Case Management Core

> **Build timeline:** Weeks 3–4 | **Milestone:** v1.1

### Case CRUD
- [ ] Case create from signed lead (auto-populated from lead data)
- [ ] Case fields: case number, client, case type (auto/slip-fall/dog-bite/other), date of loss, SOL date, assigned attorney, status, description
- [ ] Case status lifecycle: intake → investigation → demand → negotiation → settlement/litigation → closed
- [ ] Case list with filters: status, attorney, SOL date, date opened

### SOL Tracking
- [ ] SOL date stored per case
- [ ] Alert thresholds: 90 days, 60 days, 30 days before SOL
- [ ] Dashboard: cases with SOL < 90 days highlighted
- [ ] Email/SMS alert to assigned attorney (n8n workflow)

### Client Management
- [ ] Client record: name, DOB, contact info, injury description, insurance info
- [ ] Client → Cases linkage (one client, potentially multiple cases)
- [ ] Intake form (web form for new client intake)

### Medical Records Tracking
- [ ] Per-case medical provider list
- [ ] Records request status: requested / received / reviewed
- [ ] Lien amounts per provider
- [ ] Medical specials total (sum of all provider bills)

### Tasks + Deadlines
- [ ] Task CRUD: title, due date, assigned to, case linkage, status
- [ ] Deadline types: SOL, hearing, deposition, demand deadline, response deadline
- [ ] Dashboard: today's tasks + upcoming deadlines

### Documents
- [ ] Document upload (PDF, DOCX, images) with case linkage
- [ ] Document type tagging: retainer, medical, pleading, correspondence, settlement
- [ ] Document list on case detail

---

## Phase 3 — Document AI

> **Build timeline:** Week 5 | **Milestone:** v1.2

- [ ] Medical record upload → Claude API → extract: provider, dates, injuries, treatment, specials total
- [ ] Medical summary card per provider on case detail
- [ ] Demand letter draft: case facts + medical summaries → Claude API → editable draft
- [ ] Document auto-classification on upload (Claude API)
- [ ] AI intake summary: transcript/notes → injury description + liability assessment + next steps

---

## Phase 4 — Revenue Growth

> **Build timeline:** Week 6+ | **Milestone:** v2.0

- [ ] Lost lead resurrection: automated re-engagement sequence for leads > 30 days inactive
- [ ] Referral flywheel: track referral sources, automate thank-you sequences to partners
- [ ] Review-to-case conversion: monitor Google Reviews mentions, route to intake
- [ ] Partner referral networks: attorney and medical provider relationship tracking
- [ ] Revenue share tracking: calculate and report referral commissions

---

## Phase 5 — Billing + Finance

> **Milestone:** v2.1

- [ ] Settlement offer/counter log with dates and amounts
- [ ] Disbursement calculator: settlement → attorney fee (%) → costs → net to client
- [ ] Fee ledger: cost tracking (medical liens, filing fees, expert fees)
- [ ] Settlement summary report

---

## Phase 6 — Client Portal + Analytics

> **Milestone:** v2.2

- [ ] External client login (separate from staff login, limited scope)
- [ ] Client portal: case status view, shared documents, timeline
- [ ] Staff can push documents to client portal
- [ ] Analytics dashboard: case values, settlement rates, revenue attribution
- [ ] Referral source attribution (which channels produce signed cases)
