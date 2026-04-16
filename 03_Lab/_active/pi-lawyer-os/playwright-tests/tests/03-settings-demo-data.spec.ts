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

test.describe('Settings + Demo Data', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('settings page loads with all card headings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Assistant — LLM' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Demo Data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Temporal Test Generator' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Interface Language' })).toBeVisible();
  });

  test('account info shows correct user', async ({ page }) => {
    await expect(page.getByText('admin@demo.pilaweros.local')).toBeVisible();
    await expect(page.getByRole('main').getByText('Demo Law Firm')).toBeVisible();
  });

  test('generate demo data creates all records with correct counts', async ({ page }) => {
    test.setTimeout(120000);

    // Click Generate Demo Data
    const generateBtn = page.getByRole('button', { name: 'Generate Demo Data' });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Wait for success toast/message
    await expect(page.getByText('Demo data generated')).toBeVisible({ timeout: 90000 });

    // Verify success message mentions correct counts
    const successArea = page.locator('.bg-green-50, [class*="green"]');
    await expect(successArea.getByText(/5 partners/)).toBeVisible({ timeout: 5000 });
    await expect(successArea.getByText(/12 leads/)).toBeVisible({ timeout: 5000 });
    await expect(successArea.getByText(/5 cases/)).toBeVisible({ timeout: 5000 });
  });

  test('check counts badge shows 12 leads and 5 cases after demo data', async ({ page, request }) => {
    // Verify via API that demo data is present
    const jwt = await getJwt(request);
    const leadsRes = await request.get(`${POSTGREST}/leads?select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    expect(leadsRes.status()).toBe(200);
    const leads = await leadsRes.json();
    expect(leads.length).toBeGreaterThanOrEqual(12);

    const casesRes = await request.get(`${POSTGREST}/cases?select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const cases = await casesRes.json();
    expect(cases.length).toBeGreaterThanOrEqual(5);

    // Also verify the UI check counts button works
    const checkBtn = page.getByRole('button', { name: 'Check counts' }).or(page.getByRole('button', { name: 'Check Counts' }));
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=/\\d+ leads/').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('all 5 case statuses present after demo data', async ({ request }) => {
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

  test('TTG card has correct config controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Temporal Test Generator' })).toBeVisible();
    // "Tick every" select with default "5 seconds"
    await expect(page.getByText('Tick every')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Generator/ })).toBeVisible();
  });

  test('TTG start/stop cycle generates events', async ({ page }) => {
    test.setTimeout(60000);

    const startBtn = page.getByRole('button', { name: 'Start Generator' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Should show pulsing Running indicator
    await expect(page.getByText('Running', { exact: true })).toBeVisible({ timeout: 5000 });

    // Wait for at least one tick (default 5s + buffer)
    await page.waitForTimeout(8000);

    // Stats bar should appear with events > 0
    await expect(page.getByText(/Events generated:/)).toBeVisible({ timeout: 10000 });

    // Stop
    const stopBtn = page.getByRole('button', { name: 'Stop Generator' });
    await stopBtn.click();
    await expect(page.getByText('Running', { exact: true })).not.toBeVisible({ timeout: 5000 });
  });

  test('clear all data resets counts to zero', async ({ page, request }) => {
    test.setTimeout(60000);
    const jwt = await getJwt(request);

    // Handle the window.prompt dialog
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept('CLEAR');
      else await dialog.dismiss();
    });

    const clearBtn = page.getByRole('button', { name: 'Clear All Data' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Wait for clear to complete
    await expect(page.getByText('All firm data has been cleared')).toBeVisible({ timeout: 30000 });

    // Verify via API
    const leadsRes = await request.get(`${POSTGREST}/leads?select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const leads = await leadsRes.json();
    expect(leads.length).toBe(0);
  });
});
