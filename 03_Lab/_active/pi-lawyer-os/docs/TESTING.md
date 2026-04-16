# E2E Testing

## Stack

- **Framework:** Playwright + Chromium (single browser, sequential)
- **Base URL:** `http://10.10.110.33`
- **Timeout:** 30s per test, 8s expect timeout
- **Retries:** 1 retry on failure
- **Reports:** HTML (`playwright-report/`) + list output

## Credentials

| Account | Email | Password |
|---------|-------|----------|
| Staff (admin) | `admin@demo.pilaweros.local` | `Admin1234!` |
| Portal (Williams) | `portal@williams.demo` | `Portal2026!` |

## Run

```bash
cd playwright-tests
npm test
# or specific file:
npx playwright test tests/05-cases.spec.ts
# or headed (visible browser):
npx playwright test --headed
```

## Prerequisites

Before running tests, generate demo data:
1. Login at `http://10.10.110.33`
2. Navigate to Settings
3. Click "Generate Demo Data"
4. Wait for success message

Tests 03, 04, 05, 06, 07, 08 depend on demo data being present.

---

## Coverage Map — 14 Test Files

| File | Phase | Coverage | Tests |
|------|-------|----------|-------|
| `01-auth.spec.ts` | 1 | Login, JWT, protected routes | ~5 |
| `02-dashboard.spec.ts` | 1 | KPI cards, SOL alerts, charts, sidebar nav | ~5 |
| `03-settings-demo-data.spec.ts` | 1+TTG | Demo data generation, counts validation, TTG start/stop | ~7 |
| `04-leads.spec.ts` | 1 | Lead list, status filter, detail view, comms round-trip | ~5 |
| `05-cases.spec.ts` | 2 | All 5 statuses, all 7 tabs, Documents/Demand Letter/Billing data | ~11 |
| `06-partners.spec.ts` | 4 | Partner list (5), names, referral summary, commission | ~6 |
| `07-analytics.spec.ts` | 6 | KPI tiles, charts, lead funnel, partner performance | ~6 |
| `08-portal.spec.ts` | 6 | Portal login/error/redirect, case info display | ~6 |
| `09-wyatt.spec.ts` | 11 | Gateway health, OpenClaw UI, LLM settings, persist | ~9 |
| `10-automation.spec.ts` | 7 | n8n UI, JWT, webhook routing, stub SMS all 5 workflows | ~8 |
| `11-intake-form.spec.ts` | 9 | Public intake form, 3-step flow, API intake endpoint | ~7 |
| `12-multilingual-firm-ops.spec.ts` | 10 | Language toggle, team management, audit log, create-user | ~14 |
| `13-advanced-ai.spec.ts` | 11 | RAG endpoints, objection library, demand letter | ~8 |
| `14-platform-scale.spec.ts` | 12 | Firm branding schema, document templates, Stripe columns | ~8 |

**Total: ~115 tests**

---

## CI/CD Integration

Tests run in the GitLab CI pipeline on every push to `main`:

```yaml
stages:
  - lint
  - test        # ← Playwright runs here
  - deploy
  - health-check
```

The `test` stage runs before `deploy-production` — a failing test gate blocks deployment.

See `.gitlab-ci.yml` for full configuration.

---

## Writing New Tests

- Use `loginAsStaff(page)` from `helpers.ts` for authenticated tests
- Use `getJwt(request)` pattern for API-layer assertions
- Avoid `waitForTimeout()` — use `waitForLoadState('networkidle')` or explicit element waits
- After create/update actions, verify via API (`request.get(POSTGREST + ...)`)
- Assert data values, not just element presence

```typescript
// Good: data assertion
const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2025-001&select=status`);
const cases = await res.json();
expect(cases[0].status).toBe('negotiation');

// Bad: visibility only
await expect(page.getByText('negotiation')).toBeVisible();
```
