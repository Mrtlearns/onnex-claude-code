# Phase 10 — Multilingual + Firm Ops

**Milestone:** v3.3

## Scope

Spanish language support for intake + SMS; admin tools for user management and audit logs; attorney performance dashboard. Makes the product viable in Las Vegas (large Spanish-speaking PI client base) and gives firm admins operational control.

---

## Wave 1: Spanish Language Support

**Goal:** UI language toggle (EN/ES); all SMS templates bilingual; intake form in Spanish.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Add `preferred_language` field to `leads` table (default: 'en') and `clients` table | `postgres/migrations/011_multilingual.sql` | No |
| 1.2 | Create `i18n/es.ts` with Spanish translations for all UI strings (nav, lead/case labels, status names, button labels) | `frontend/src/i18n/es.ts` | No |
| 1.3 | Add language toggle to Settings page + store in localStorage; apply i18n context to all pages | `frontend/src/pages/Settings.tsx` | No |
| 1.4 | Add Spanish SMS templates to n8n workflows: all 6 automation workflows send bilingual SMS if lead.preferred_language = 'es' | all n8n workflow files | No |
| 1.5 | Update web intake form (`/intake`) to detect browser language and show Spanish version if `navigator.language` starts with 'es' | `frontend/src/pages/IntakeForm.tsx` | No |

---

## Wave 2: User Management

**Goal:** Admin can create, edit, and deactivate staff user accounts from the Settings page.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Add `active BOOLEAN DEFAULT true` to `users` table; add `POST /auth/create-user` and `PATCH /auth/update-user/{id}` endpoints (admin role required) | `auth/main.py` | No |
| 2.2 | Frontend: "Team" tab in Settings page — list staff users with role badges; "Add User" form (name, email, role, temp password); "Deactivate" button | `frontend/src/pages/Settings.tsx` | No |
| 2.3 | Auth service: enforce `active = true` check on login — return 403 for deactivated accounts | `auth/main.py` | No |

---

## Wave 3: Audit Log Viewer

**Goal:** Per-entity audit trail visible in the UI. The `audit_log` table already exists from Phase 1.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Verify `audit_log` table structure and PostgREST access; ensure RLS scopes to firm_id | `postgres/init.sql` (review) | No |
| 3.2 | Frontend: `AuditLogPanel` component — paginated list of audit events (actor, action, entity type, entity id, timestamp); add to LeadDetail and CaseDetail as collapsible section | `frontend/src/components/AuditLogPanel.tsx` | No |
| 3.3 | Backend: ensure CRUD operations on leads, cases, documents write to audit_log (add DB triggers if missing) | `postgres/migrations/011_multilingual.sql` | No |

---

## Wave 4: Attorney Performance Dashboard

**Goal:** Per-attorney KPIs for managing partners to review attorney output.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | DB view `attorney_performance`: join users + cases + case_settlements; metrics: case count by status, avg case duration (created_at to settled_at), avg gross settlement, total fees earned | `postgres/migrations/011_multilingual.sql` | No |
| 4.2 | Frontend: `AttorneyPerformanceTable` on Analytics page — table with columns: attorney name, open cases, settled this year, avg settlement, avg days-to-settle | `frontend/src/pages/Analytics.tsx` | No |

---

## Success Criteria

- [ ] UI toggles to Spanish — nav, labels, status names all translated
- [ ] Spanish SMS sent to leads with preferred_language = 'es'
- [ ] Admin can create a new staff user; user can log in; admin can deactivate
- [ ] Deactivated users cannot log in (403)
- [ ] Audit log panel shows at least 5 events on a lead/case with demo data
- [ ] Attorney performance table renders on Analytics with demo data

---

## Technical Notes

- i18n: use React context (no external lib required) — simple key lookup `t('key')`
- Language toggle: persist in localStorage as `'lang'` key; default `'en'`
- audit_log: if table doesn't exist yet, add in migration 011 with columns: id, firm_id, actor_id, action, entity_type, entity_id, created_at
- attorney_performance view: filter by `cases.firm_id` via RLS; `attorney_id` is `cases.assigned_attorney_id`
