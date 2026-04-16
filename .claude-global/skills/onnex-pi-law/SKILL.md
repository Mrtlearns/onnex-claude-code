# Onnex PI Law Skill

Onnex serves Personal Injury (PI) law firms as a vertical. Apply this domain knowledge when working on pi-lawyer-os, PI Growth OS, or any PI law firm client deliverables.

---

## PI Law Firm Business Model

### How PI Firms Work
- **Contingency fee**: Firm earns 33-40% of settlement — no upfront client cost
- **Speed matters**: First firm to contact an injured person often gets the case
- **Volume game**: High case volume with varying settlement sizes
- **Cost of capital**: Firm fronts medical/investigation costs — recovered at settlement
- **Case lifecycle**: Lead → Intake → Medical Treatment → Demand → Negotiation → Settlement/Litigation

### Key Metrics
- **Speed-to-lead**: Time from inquiry to first contact — sub-60 seconds is competitive
- **Intake conversion rate**: % of leads that sign a retainer
- **Case resolution time**: Average months to settlement
- **Average settlement value**: Varies by injury type — soft tissue vs catastrophic
- **Cost per acquisition**: Marketing spend per signed case

---

## Case Lifecycle Stages

```
Lead Capture
    ↓
Speed-to-Lead Response (< 60s target)
    ↓
Intake Qualification
    ↓
Retainer Signed
    ↓
Medical Treatment Monitoring
    ↓
Medical Records Collection
    ↓
Demand Package Preparation
    ↓
Demand Sent to Insurance
    ↓
Negotiation
    ↓
Settlement / File Suit
    ↓
Disbursement
    ↓
Case Closed
```

---

## PI Growth OS Architecture

### Core Stack
- **PostgreSQL**: 20-table schema with RLS — multi-tenant, firm-isolated
- **Hasura**: GraphQL layer over PostgreSQL
- **Temporal**: Critical-path workflow orchestration (not n8n for these — too important to lose)
- **n8n**: Non-critical automations, integrations, notifications
- **FastAPI**: REST endpoints for external integrations
- **Twilio**: SMS and voice — primary communication channel

### Temporal Workflows (Critical Path)
- **Speed-to-lead workflow**: Triggered on new lead → assign → notify → escalate if no contact in 5min
- **Missed call workflow**: Twilio webhook → check hours → SMS callback sequence → log outcome
- **Intake workflow**: Form submission → qualification → schedule call → send retainer → follow-up
- **Retainer workflow**: Signed → onboarding → assign case manager → set treatment reminders

### Key Database Tables
- `firms` — multi-tenant root
- `leads` — inbound inquiries
- `cases` — signed retainer clients
- `contacts` — all persons (leads, clients, witnesses, providers)
- `communications` — all touchpoints (calls, SMS, emails)
- `medical_providers` — treating doctors, facilities
- `medical_records` — document tracking
- `demands` — demand package tracking
- `settlements` — settlement amounts, disbursements
- `tasks` — staff task queue
- `documents` — file storage references (MinIO)

---

## Automation Patterns

### Speed-to-Lead (Most Critical)
```
Twilio/Web Lead → n8n webhook → Temporal workflow:
  1. Validate lead data
  2. Deduplicate (check existing contacts)
  3. Create lead record
  4. Assign to available intake specialist
  5. Trigger Twilio auto-call + SMS simultaneously
  6. If no answer in 60s → SMS with callback link
  7. If no response in 5min → escalate to next specialist
  8. Log all attempts
```

### Missed Call Recovery
```
Twilio webhook (missed call) → check business hours:
  - Business hours: immediate callback SMS + auto-dial attempt
  - After hours: SMS with morning callback promise + calendar link
  - No response after 24h: nurture sequence begins
```

### Document Collection
```
Medical record request → fax/portal → received → OCR → 
extract key data (diagnosis, treatment dates, costs) → 
update case record → notify case manager
```

---

## Twilio Integration Standards

- Use Twilio Programmable Voice for outbound calls — record with consent disclosure
- Use Twilio SMS for rapid response — 160 char limit, no legal disclaimers in first message
- Twilio webhooks: validate `X-Twilio-Signature` header — reject unsigned requests
- Phone number formatting: always E.164 (`+17025551234`)
- Do not log full call recordings to database — store reference URL only (Twilio stores media)

---

## Jurisdiction Context

### Nevada (Primary Market — Las Vegas)
- Statute of limitations: 2 years from date of injury (NRS 11.190)
- Pure comparative negligence — plaintiff recovery reduced by their % of fault
- Medical lien: providers can file liens on settlements
- No-fault auto insurance: Nevada is NOT a no-fault state — fault matters

### California (Expansion Market — LA)
- SOL: 2 years generally, but exceptions for government claims (6 months), minors, discovery rule
- Pure comparative negligence (same as NV)
- Proposition 213: limits recovery for uninsured drivers
- CCPA: stricter data privacy than Nevada — apply to all CA client data

---

## Client Profile

### Decision Makers
- Managing Partner / Owner — cares about ROI, case volume, growth
- Operations Manager — cares about staff efficiency, workflow
- Lead Intake Manager — cares about conversion rate, response time

### Common Pain Points
- Missing leads due to slow response (calls go to voicemail)
- Manual intake process (staff on phone for 45+ min per lead)
- No visibility into case pipeline
- Medical record collection bottleneck
- Disorganized communication history per client

### What Onnex Delivers
- Automated speed-to-lead response (sub-60s)
- Structured intake with qualification scoring
- Case pipeline dashboard
- Automated document request and tracking
- Communication timeline per case
- Retainer automation (DocuSign integration)

---

## Sensitive Data Handling

- **Attorney-client privilege**: Case notes, strategy, communications are privileged — never log to external systems
- **PII**: SSN, DOB, medical info — encrypt at rest, restrict access by role
- **Settlement amounts**: Confidential — RLS policy: only firm staff + client can access own case
- **Medical records**: HIPAA-adjacent even in legal context — treat as sensitive
- Never route case data through shared/multi-tenant AI processing — use isolated inference
