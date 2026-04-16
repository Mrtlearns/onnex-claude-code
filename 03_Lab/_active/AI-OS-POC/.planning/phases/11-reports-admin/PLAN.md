# Phase 11 — Reports + Admin: Plan

**Created:** 2026-04-07
**Status:** Ready
**Milestone:** v2.1

---

## Scope

Phase 11 delivers two high-visibility modules: a Reports dashboard with KPI rollups and revenue/utilization charts, and an Admin panel with user management, tenant settings, and RBAC role assignment. Both modules follow TDD discipline (tests written before implementation) and multi-tenant isolation. All data is sourced from existing Phase 09 financial tables (invoices, time_entries, deals) and a new `tenant_members` table introduced in this phase.

---

## Data Model Additions

Two new tables added via migrations in `apps/api/src/index.ts` (alongside existing `memory_entries` migration):

```sql
-- tenant_members: local role registry per tenant (Authentik sub as user_id)
CREATE TABLE IF NOT EXISTS tenant_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,        -- Authentik JWT sub
  display_name TEXT,
  email        TEXT,
  role         TEXT NOT NULL DEFAULT 'team_member',
  status       TEXT NOT NULL DEFAULT 'active',  -- active | suspended
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- tenant_settings: per-tenant configuration
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id     TEXT PRIMARY KEY,
  display_name  TEXT,
  billing_email TEXT,
  timezone      TEXT DEFAULT 'UTC',
  logo_url      TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## Waves

### Wave 1: Reports API (TDD)
**Goal:** Fastify BFF routes that aggregate financial + time data into report payloads. Tests written first.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Write Vitest tests for `/reports/kpi`, `/reports/revenue`, `/reports/utilization` | `apps/api/src/__tests__/reports.test.ts` | No |
| 1.2 | Implement `reports.ts` route — KPI endpoint: paid revenue, outstanding AR, active projects, open deal value, billable hours MTD | `apps/api/src/routes/reports.ts` | No |
| 1.3 | Implement revenue endpoint: invoices grouped by month + status, ?from=&to= filters | `apps/api/src/routes/reports.ts` | No |
| 1.4 | Implement utilization endpoint: SUM(duration_minutes) by user_id, grouped billable vs non-billable, ?from=&to= filters | `apps/api/src/routes/reports.ts` | No |
| 1.5 | Register `reportsRoutes` in `index.ts` | `apps/api/src/index.ts` | No |

**Route specs:**
- `GET /api/v1/reports/kpi` — requires `authenticate`; roles: all; returns `{ revenue_paid, revenue_outstanding, active_projects, open_deals_value, billable_hours_mtd }`
- `GET /api/v1/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns `[{ month, paid, sent, draft }]`
- `GET /api/v1/reports/utilization?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns `[{ user_id, billable_minutes, non_billable_minutes }]`

---

### Wave 2: Reports UI
**Goal:** Reports page renders KPI cards, revenue bar chart, and utilization chart. Tests written first.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Write Vitest tests for `<KpiCards>`, `<RevenueChart>`, `<UtilizationChart>` components | `apps/web/src/__tests__/reports-kpi.test.tsx`, `apps/web/src/__tests__/reports-charts.test.tsx` | No |
| 2.2 | Build `<KpiCards>` — 5 stat tiles (revenue paid, outstanding AR, active projects, pipeline value, billable hrs MTD) using shadcn `Card` | `apps/web/src/app/(protected)/reports/components/kpi-cards.tsx` | No |
| 2.3 | Build `<RevenueChart>` — Recharts `BarChart` grouped by month, stacked by status (paid/sent/draft); add `recharts` to web package | `apps/web/src/app/(protected)/reports/components/revenue-chart.tsx` | No |
| 2.4 | Build `<UtilizationChart>` — Recharts `BarChart` stacked billable vs non-billable per user | `apps/web/src/app/(protected)/reports/components/utilization-chart.tsx` | No |
| 2.5 | Wire `reports/page.tsx` — TanStack Query fetches for all 3 endpoints, `HydrationBoundary` SSR, date range picker via shadcn `Popover` | `apps/web/src/app/(protected)/reports/page.tsx` | No |

---

### Wave 3: Admin API (TDD)
**Goal:** Fastify BFF routes for user management + tenant settings. Tests first.

**Depends on:** Wave 1 complete (migrations run first)

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Add `tenant_members` + `tenant_settings` migrations to `runMigrations()` | `apps/api/src/index.ts` | No |
| 3.2 | Add `TenantMember` + `TenantSettings` interfaces to schema | `apps/api/src/db/schema.ts` | No |
| 3.3 | Write Vitest tests for all admin routes | `apps/api/src/__tests__/admin.test.ts` | No |
| 3.4 | Implement `admin.ts` — user management routes | `apps/api/src/routes/admin.ts` | No |
| 3.5 | Implement tenant settings routes in `admin.ts` | `apps/api/src/routes/admin.ts` | No |
| 3.6 | Register `adminRoutes` in `index.ts` | `apps/api/src/index.ts` | No |

**Route specs (all require `admin` or `super_admin` role):**
- `GET /api/v1/admin/users` — list tenant_members for tenant
- `POST /api/v1/admin/users` — insert member `{ user_id, display_name, email, role }`
- `PATCH /api/v1/admin/users/:id/role` — update role `{ role }`
- `PATCH /api/v1/admin/users/:id/status` — update status `{ status: 'active' | 'suspended' }`
- `DELETE /api/v1/admin/users/:id` — hard delete member record
- `GET /api/v1/admin/tenant` — get/upsert tenant_settings row
- `PATCH /api/v1/admin/tenant` — update tenant settings `{ display_name, billing_email, timezone, logo_url }`

---

### Wave 4: Admin UI
**Goal:** Admin page renders user management table and tenant settings form. Tests first.

**Depends on:** Wave 3 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Write Vitest tests for `<UserTable>` and `<TenantSettingsForm>` | `apps/web/src/__tests__/admin-users.test.tsx`, `apps/web/src/__tests__/admin-settings.test.tsx` | No |
| 4.2 | Build `<UserTable>` — shadcn `Table` with columns: name, email, role badge, status badge, actions (change role dropdown, suspend/reactivate, delete); `RoleGate` hides destructive actions below admin | `apps/web/src/app/(protected)/admin/components/user-table.tsx` | No |
| 4.3 | Build `<InviteUserDialog>` — shadcn `Dialog` + React Hook Form + Zod: fields user_id (Authentik sub), display_name, email, role select | `apps/web/src/app/(protected)/admin/components/invite-user-dialog.tsx` | No |
| 4.4 | Build `<TenantSettingsForm>` — React Hook Form + Zod: display_name, billing_email, timezone select, logo_url | `apps/web/src/app/(protected)/admin/components/tenant-settings-form.tsx` | No |
| 4.5 | Wire `admin/page.tsx` — two tabs (Users / Settings), TanStack Query mutations for all admin actions, `RoleGate` wrapping entire page (admin+ only) | `apps/web/src/app/(protected)/admin/page.tsx` | No |

---

## Success Criteria

- [ ] `GET /api/v1/reports/kpi` returns correct aggregates scoped to tenant
- [ ] `GET /api/v1/reports/revenue` returns monthly revenue breakdown
- [ ] `GET /api/v1/reports/utilization` returns per-user billable breakdown
- [ ] All 3 report endpoints have Vitest coverage (GREEN)
- [ ] Reports page renders KPI cards + 2 charts with real data
- [ ] `GET /api/v1/admin/users` returns tenant-scoped member list
- [ ] Role change + status change + delete all work correctly
- [ ] Tenant settings GET/PATCH work with upsert logic
- [ ] All admin routes have Vitest coverage (GREEN)
- [ ] Admin page: users tab + settings tab render and mutate correctly
- [ ] `RoleGate` prevents non-admin users from accessing Admin page
- [ ] Multi-tenant isolation verified: no cross-tenant data leakage on any route
- [ ] All new routes registered and health-checked

---

## Technical Specifics

### RBAC Gates
| Route group | Required roles |
|-------------|----------------|
| Reports (read) | all authenticated users |
| Admin users | `admin`, `super_admin` |
| Admin tenant | `admin`, `super_admin` |

### Recharts
- Add `recharts` to `apps/web/package.json`
- Use `ResponsiveContainer` for all charts (auto-width)
- Wrap chart components in `"use client"` — Recharts is browser-only

### Date Range Defaults
- Revenue + utilization: default to last 30 days if `?from/to` not provided
- Store date pickers in local component state (not URL params for POC)

### TanStack Query Keys
```ts
['reports', 'kpi']
['reports', 'revenue', { from, to }]
['reports', 'utilization', { from, to }]
['admin', 'users']
['admin', 'tenant']
```

### File Conventions
- New API routes: `apps/api/src/routes/<name>.ts`
- New API tests: `apps/api/src/__tests__/<name>.test.ts`
- New web components: `apps/web/src/app/(protected)/<module>/components/<component>.tsx`
- New web tests: `apps/web/src/__tests__/<name>.test.tsx`

### Key Commands
```bash
# Run API tests
cd apps/api && npx vitest run

# Run web tests
cd apps/web && npx vitest run

# Type-check
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

---

## Deferred (Out of Scope for Phase 11)

- Authentik API integration for user provisioning (invite sends actual email via Authentik)
- PDF export of reports
- Date range URL persistence / shareable report links
- Per-project utilization drilldown (Wave 2 covers per-user only)
- Audit log / activity trail for admin actions
- Kanban DnD persistence (v3.0)
- Invoice PDF + SMTP (already implemented in Phase 09 routes, UX wiring is v3.0)
