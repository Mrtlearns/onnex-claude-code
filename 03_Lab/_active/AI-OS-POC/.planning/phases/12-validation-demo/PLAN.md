# Phase 12 — Validation + Demo Seed: Plan

**Created:** 2026-04-17
**Status:** Ready
**Milestone:** v3.0

---

## Scope

Phase 12 delivers three things that make the platform demo-ready and production-verifiable: a clean test suite (fix 5 pre-existing failures), a formal VALIDATION.md checklist that defines what "production-ready" means, and an automated demo seed script that populates all 8 modules with realistic data in under 5 minutes. No infrastructure changes — this is the code-only v3.0 wave.

Note: Kanban DnD persistence, Invoice PDF, and Invoice SMTP are already implemented on the VM (discovered during Phase 11 sync) and do not need to be built.

---

## Pre-existing Failures (to fix)

| File | Failure | Root Cause |
|------|---------|------------|
| `apps/api/src/__tests__/rbac.test.ts` | `mapGroupsToRoleApi is not a function` (3 tests) | Function exists in `require-role.ts` but is not exported |
| `apps/api/src/__tests__/rbac.test.ts` | `super_admin bypasses role check — expected 200, got 403` | `requireRole` doesn't short-circuit for `super_admin` role |
| `apps/api/src/__tests__/tasks.test.ts` | `POST /:id/comments — Cannot read properties of undefined (reading 'rows')` | Mock `pool.query` called twice but only one `mockResolvedValueOnce` provided |
| `apps/web/src/__tests__/kanban-board.test.tsx` | `renders 4 kanban columns — 998ms timeout` | @dnd-kit mocks or async render hanging |

---

## Waves

### Wave 1: Fix Pre-existing Test Failures
**Goal:** All existing tests GREEN. Clean baseline before v3.0 work proceeds.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Export `mapGroupsToRoleApi` from `require-role.ts` | `apps/api/src/plugins/require-role.ts` | No |
| 1.2 | Add `super_admin` bypass to `requireRole` — short-circuit before role array check | `apps/api/src/plugins/require-role.ts` | No |
| 1.3 | Fix `tasks.test.ts` comments mock — add second `mockResolvedValueOnce` for INSERT query | `apps/api/src/__tests__/tasks.test.ts` | No |
| 1.4 | Fix `kanban-board.test.tsx` timeout — investigate @dnd-kit mock or wrap in `act()` | `apps/web/src/__tests__/kanban-board.test.tsx` | No |
| 1.5 | Run full test suite — confirm 0 failures | Both apps | No |

**Success gate:** `npx vitest run` GREEN in both `apps/api` and `apps/web` with 0 failures.

---

### Wave 2: VALIDATION.md
**Goal:** Formal production-readiness checklist. One document that defines "done" for v3.0 and serves as the demo sign-off gate.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Write `VALIDATION.md` — sections: Auth, Multi-tenancy, API health, UI smoke test, Test coverage, Infrastructure, Demo env | `VALIDATION.md` (project root) | No |
| 2.2 | Run through each section against the live VM — fill in pass/fail/manual for each criterion | `VALIDATION.md` | No |
| 2.3 | Document known gaps (Traefik TLS, Authentik E2E) as explicit Phase 13 deferrals | `VALIDATION.md` | No |

**VALIDATION.md sections:**
```
## 1. Authentication & RBAC
## 2. Multi-tenancy Isolation
## 3. API Routes (all modules)
## 4. UI Smoke Test (golden paths)
## 5. Test Coverage
## 6. Infrastructure (Docker stack)
## 7. Demo Environment
## 8. Known Gaps (deferred to Phase 13)
```

---

### Wave 3: Demo Seed Script
**Goal:** Single command populates all 8 modules with realistic agency data. Fresh tenant ready for demo in <5 min.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Write `scripts/seed_demo.py` — tenant: `demo-tenant`, data covers all modules | `scripts/seed_demo.py` | Yes (engineer) |
| 3.2 | Seed: 3 clients, 2 projects, 8 tasks (mix of statuses), 3 deals (different pipeline stages) | `scripts/seed_demo.py` | Yes (engineer) |
| 3.3 | Seed: 2 invoices (1 paid, 1 sent) with line items, 5 time entries across 2 users | `scripts/seed_demo.py` | Yes (engineer) |
| 3.4 | Seed: 3 contacts linked to clients, 1 tenant settings row | `scripts/seed_demo.py` | Yes (engineer) |
| 3.5 | Add `scripts/clear_demo.py` — deletes all rows WHERE tenant_id = 'demo-tenant' | `scripts/clear_demo.py` | No |
| 3.6 | Test seed script against live VM via SSH | VM | No |

**Seed data spec:**
- Tenant ID: `demo-tenant`
- Clients: `Apex Innovations`, `BlueStar Media`, `Cornerstone Legal`
- Projects: `Apex Website Redesign` (active), `BlueStar Brand Campaign` (active)
- Tasks: mix of Backlog / In Progress / Review / Done
- Deals: `Enterprise SaaS Package` (negotiation), `Branding Retainer` (proposal), `SEO Campaign` (closed-won)
- Invoices: INV-001 (paid, $12,500), INV-002 (sent, $8,750)
- Time entries: realistic durations (90–480 min), billable + non-billable mix

---

## Success Criteria

- [ ] `npx vitest run` in `apps/api` — 0 failures (was 5)
- [ ] `npx vitest run` in `apps/web` — 0 failures (was 2)
- [ ] `VALIDATION.md` exists at project root with all sections filled
- [ ] At least 10/12 VALIDATION.md criteria pass on live VM
- [ ] `python scripts/seed_demo.py` runs against VM with exit 0
- [ ] After seed: all 8 modules show data in browser (`http://10.10.110.31:3002`)
- [ ] `python scripts/clear_demo.py` removes all demo data cleanly

---

## Technical Specifics

### require-role.ts fixes

**Task 1.1 — Export mapGroupsToRoleApi:**
The function already exists internally. Just add it to the exports:
```ts
export { mapGroupsToRoleApi }  // or export function mapGroupsToRoleApi(...)
```

**Task 1.2 — super_admin bypass:**
In `requireRole`, before checking the allowed roles array, add:
```ts
if (request.user?.role === 'super_admin') return  // bypass all role gates
```

**Task 1.3 — tasks.test.ts comments mock:**
The `POST /tasks/:id/comments` handler calls `pool.query` twice:
1. First to check the task exists
2. Second to insert the comment
The test only provides one `mockResolvedValueOnce`. Add a second:
```ts
const mockQuery = vi.fn()
  .mockResolvedValueOnce({ rows: [{ id: TASK_ID }] })  // task exists check
  .mockResolvedValueOnce({ rows: [{ id: '...', body: 'test comment' }] })  // insert
```

### Seed script approach
- Pure Python, uses `psycopg2` (already available on VM)
- Connects via `DATABASE_URL` env var or falls back to `postgresql://aios:aios@localhost:5432/aios`
- Idempotent: `INSERT ... ON CONFLICT DO NOTHING` where possible
- Run on VM: `python3 scripts/seed_demo.py`
- Or SSH: `ssh mrt@jumpbox "sshpass ... ssh root@vm 'cd /opt/agency-ai-os && python3 scripts/seed_demo.py'"`

### Key Commands
```bash
# Run API tests
cd apps/api && npx vitest run

# Run web tests
cd apps/web && npx vitest run

# Run seed (on VM)
python3 scripts/seed_demo.py

# Clear demo data
python3 scripts/clear_demo.py

# Type-check
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

---

## Deferred (Out of Scope for Phase 12)

- Traefik TLS for all services → Phase 13
- Authentik full browser E2E test → Phase 13
- Performance profiling + bundle optimization → Phase 14
- `/promote` to GitLab CI/CD → Phase 15
- Kanban DnD persistence — already implemented (discovered in Phase 11 sync)
- Invoice PDF + SMTP — already implemented (discovered in Phase 11 sync)
