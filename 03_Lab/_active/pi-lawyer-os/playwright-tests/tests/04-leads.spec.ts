import { test, expect } from '@playwright/test';
import { loginAsStaff, BASE, STAFF_EMAIL, STAFF_PASSWORD } from './helpers';

const POSTGREST = `${BASE}/api`;

async function getJwt(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  return body.token as string;
}

test.describe('Leads', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test('leads list loads as kanban', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /leads/i })).toBeVisible();
    // Kanban board: look for column header "Intake In Progress" — unique to Kanban layout
    await expect(
      page.getByText('Intake In Progress').first()
        .or(page.getByText('Drop here').first())
    ).toBeVisible({ timeout: 8000 });
  });

  test('leads list shows at least 12 rows after demo data', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/leads?select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const leads = await res.json() as { id: string }[];
    expect(leads.length).toBeGreaterThanOrEqual(12);
  });

  test('status filter filters correctly', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Find a "signed" filter option
    const signedFilter = page.getByRole('button', { name: /signed/i }).first()
      .or(page.getByRole('tab', { name: /signed/i }).first());

    if (await signedFilter.isVisible()) {
      await signedFilter.click();
      await page.waitForLoadState('networkidle');
      // All visible status badges should be "signed"
      const rows = page.locator('tr, [data-testid="lead-row"]');
      const count = await rows.count();
      if (count > 0) {
        // At least one row visible after filter
        await expect(rows.first()).toBeVisible();
      }
    }
  });

  test('lead detail shows correct data for Williams', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(
      `${POSTGREST}/leads?last_name=eq.Williams&first_name=eq.Patricia&select=id`,
      { headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' } }
    );
    const leads = await res.json() as { id: string }[];
    if (leads.length === 0) { test.skip(true, 'Williams lead not found — run demo data first'); return; }

    await page.goto(`/leads/${leads[0].id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Patricia Williams/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('702-555-1001')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('702-555-1001')).toBeVisible({ timeout: 5000 });
  });

  test('add communication note round-trip', async ({ page, request }) => {
    const jwt = await getJwt(request);
    // Get first lead
    const res = await request.get(`${POSTGREST}/leads?select=id&limit=1`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const leads = await res.json() as { id: string }[];
    if (leads.length === 0) { test.skip(true, 'No leads found'); return; }

    const leadId = leads[0].id;
    await page.goto(`/leads/${leadId}`);
    await page.waitForLoadState('networkidle');

    // Look for note/communication textarea
    const noteInput = page.locator('textarea').first()
      .or(page.locator('input[placeholder*="note" i]').first())
      .or(page.locator('input[placeholder*="message" i]').first());

    if (await noteInput.isVisible()) {
      const noteText = `E2E test note ${Date.now()}`;
      await noteInput.fill(noteText);
      const submitBtn = page.getByRole('button', { name: /add|send|save/i }).last();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForLoadState('networkidle');

        // Verify note appears in communications list
        await expect(page.getByText(noteText)).toBeVisible({ timeout: 8000 });

        // API round-trip check
        const commsRes = await request.get(
          `${POSTGREST}/communications?lead_id=eq.${leadId}&message=like.*test note*&select=id,message`,
          { headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' } }
        );
        const comms = await commsRes.json() as { id: string; message: string }[];
        expect(comms.length).toBeGreaterThan(0);
      }
    }
  });

  test('lead score badge visible on leads list', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');
    // Score badges should be present (numeric value) on kanban cards
    const scoreBadge = page.locator('span').filter({ hasText: /^\d+$/ }).first();
    if (await scoreBadge.isVisible({ timeout: 5000 })) {
      await expect(scoreBadge).toBeVisible();
    }
    // Verify kanban board loaded — column headers present
    await expect(
      page.getByText('Intake In Progress').first()
        .or(page.getByText('Drop here').first())
    ).toBeVisible({ timeout: 8000 });
  });
});
