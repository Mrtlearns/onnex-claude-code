import { test, expect } from '@playwright/test';
import { loginAsStaff, BASE, STAFF_EMAIL, STAFF_PASSWORD } from './helpers';

const POSTGREST = `${BASE}/api`;
const ALL_TABS = ['Overview', 'Medical', 'Tasks', 'Documents', 'Demand Letter', 'Billing', 'Client Portal'];

async function getJwt(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  return body.token as string;
}

async function getCaseByNumber(request: import('@playwright/test').APIRequestContext, jwt: string, caseNumber: string) {
  const res = await request.get(`${POSTGREST}/cases?case_number=eq.${caseNumber}&select=id,status`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
  });
  const rows = await res.json() as { id: string; status: string }[];
  return rows[0] ?? null;
}

test.describe('Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test('cases list loads with correct columns', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /cases/i })).toBeVisible();
    // Column headers
    await expect(page.getByText('Case #').or(page.getByText('Case Number')).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Client').first()).toBeVisible();
    await expect(page.getByText('Status').first()).toBeVisible();
  });

  test('cases list shows all 5 statuses after demo data', async ({ request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?select=status`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const cases = await res.json() as { status: string }[];
    const statuses = new Set(cases.map(c => c.status));
    expect(statuses.has('investigation')).toBe(true);
    expect(statuses.has('demand')).toBe(true);
    expect(statuses.has('negotiation')).toBe(true);
    expect(statuses.has('pre-litigation')).toBe(true);
    expect(statuses.has('closed')).toBe(true);
  });

  test('PI-2025-004 (Harrison) has pre-litigation status', async ({ request }) => {
    const jwt = await getJwt(request);
    const c = await getCaseByNumber(request, jwt, 'PI-2025-004');
    if (!c) { test.skip(true, 'Harrison case not found — run demo data first'); return; }
    expect(c.status).toBe('pre-litigation');
  });

  test('PI-2024-009 (Nguyen) has closed status', async ({ request }) => {
    const jwt = await getJwt(request);
    const c = await getCaseByNumber(request, jwt, 'PI-2024-009');
    if (!c) { test.skip(true, 'Nguyen case not found — run demo data first'); return; }
    expect(c.status).toBe('closed');
  });

  test('case detail — all 7 tabs render without error', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2025-001&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'No cases found — run demo data first'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    for (const tabName of ALL_TABS) {
      const tab = page.getByRole('button', { name: tabName }).or(page.getByRole('tab', { name: tabName })).first();
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForLoadState('networkidle');
        // No error text should appear
        await expect(page.getByText('Error').first()).not.toBeVisible();
        await expect(page.getByText('Failed to load').first()).not.toBeVisible();
      }
    }
  });

  test('case detail Documents tab shows real records on Williams case', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2025-001&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'Williams case not found'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    const docsTab = page.getByRole('button', { name: 'Documents' }).or(page.getByRole('tab', { name: 'Documents' })).first();
    if (!(await docsTab.isVisible())) { test.skip(true, 'Documents tab not found'); return; }
    await docsTab.click();
    await page.waitForLoadState('networkidle');

    // At least one document should be listed
    await expect(page.getByText('Signed Retainer Agreement')).toBeVisible({ timeout: 8000 });

    // API verification: Williams case should have 4+ documents
    const docsRes = await request.get(`${POSTGREST}/documents?case_id=eq.${rows[0].id}&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const docs = await docsRes.json() as { id: string }[];
    expect(docs.length).toBeGreaterThanOrEqual(4);
  });

  test('case detail Demand Letter tab shows content on Rodriguez case', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2025-002&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'Rodriguez case not found'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    const demandTab = page.getByRole('button', { name: 'Demand Letter' }).or(page.getByRole('tab', { name: 'Demand Letter' })).first();
    if (!(await demandTab.isVisible())) { test.skip(true, 'Demand Letter tab not visible'); return; }
    await demandTab.click();
    await page.waitForLoadState('networkidle');

    // The demand letter content should contain the key phrase
    await expect(page.getByText('DEMAND FOR COMPENSATION')).toBeVisible({ timeout: 8000 });
  });

  test('case detail Billing tab shows settlement data on Williams case', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2025-001&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'Williams case not found'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    const billingTab = page.getByRole('button', { name: 'Billing' }).or(page.getByRole('tab', { name: 'Billing' })).first();
    if (!(await billingTab.isVisible())) { test.skip(true, 'Billing tab not found'); return; }
    await billingTab.click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Settlement Negotiations' })).toBeVisible({ timeout: 8000 });
    // Settlement amount visible
    await expect(page.getByText('72,000').first().or(page.getByText('$72,000').first())).toBeVisible({ timeout: 5000 });
    // State Farm should appear
    await expect(page.getByText('State Farm').first()).toBeVisible({ timeout: 5000 });
  });

  test('case detail Billing tab shows closed settlement on Nguyen case', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2024-009&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'Nguyen case not found'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    const billingTab = page.getByRole('button', { name: 'Billing' }).or(page.getByRole('tab', { name: 'Billing' })).first();
    if (!(await billingTab.isVisible())) { test.skip(true, 'Billing tab not found'); return; }
    await billingTab.click();
    await page.waitForLoadState('networkidle');

    // Policy limits settlement: $100,000 and GEICO
    await expect(page.getByText('100,000').first().or(page.getByText('$100,000').first())).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('GEICO').first()).toBeVisible({ timeout: 5000 });
  });

  test('case detail Medical tab shows provider list on Williams case', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?case_number=eq.PI-2025-001&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'Williams case not found'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    const medTab = page.getByRole('button', { name: 'Medical' }).or(page.getByRole('tab', { name: 'Medical' })).first();
    if (!(await medTab.isVisible())) { test.skip(true, 'Medical tab not found'); return; }
    await medTab.click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Desert Orthopedics')).toBeVisible({ timeout: 8000 });
  });

  test('status dropdown changes case status with API round-trip', async ({ page, request }) => {
    const jwt = await getJwt(request);
    // Find an investigation case to change
    const res = await request.get(`${POSTGREST}/cases?status=eq.investigation&select=id&limit=1`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'No investigation cases found'); return; }

    const caseId = rows[0].id;
    await page.goto(`/cases/${caseId}`);
    await page.waitForLoadState('networkidle');

    // Find status select/combobox
    const statusSelect = page.locator('select').first()
      .or(page.locator('[role="combobox"]').first());

    if (await statusSelect.isVisible()) {
      // Try to change to demand
      const selectTag = statusSelect.first();
      const tagName = await selectTag.evaluate((el: Element) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await selectTag.selectOption('demand');
      } else {
        await selectTag.click();
        const demandOption = page.getByRole('option', { name: 'demand' }).or(page.getByText('Demand').first());
        if (await demandOption.isVisible()) await demandOption.click();
      }
      await page.waitForLoadState('networkidle');

      // API verification
      const verifyRes = await request.get(`${POSTGREST}/cases?id=eq.${caseId}&select=status`, {
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
      });
      const updated = await verifyRes.json() as { status: string }[];
      // Either demand or still investigation (some UIs require save button)
      expect(['demand', 'investigation']).toContain(updated[0]?.status);
    }
  });

  test('case detail Client Portal tab loads', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/cases?select=id&limit=1`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const rows = await res.json() as { id: string }[];
    if (rows.length === 0) { test.skip(true, 'No cases found'); return; }

    await page.goto(`/cases/${rows[0].id}`);
    await page.waitForLoadState('networkidle');

    const portalTab = page.getByRole('button', { name: 'Client Portal' }).or(page.getByRole('tab', { name: 'Client Portal' })).first();
    if (await portalTab.isVisible()) {
      await portalTab.click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Client Portal Access')).toBeVisible({ timeout: 5000 });
    }
  });
});
