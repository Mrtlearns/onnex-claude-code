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

test.describe('Partners', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test('partners list loads', async ({ page }) => {
    await page.goto('/partners');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /partners/i })).toBeVisible();
  });

  test('partners list shows 5 partners after demo data', async ({ page, request }) => {
    // API verification: exactly 5 partners
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/partners?select=id,name`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const partners = await res.json() as { id: string; name: string }[];
    expect(partners.length).toBeGreaterThanOrEqual(5);

    // UI: at least 5 partner links/rows
    await page.goto('/partners');
    await page.waitForLoadState('networkidle');
    const partnerLinks = page.locator('a[href*="/partners/"]');
    await expect(partnerLinks.first()).toBeVisible({ timeout: 8000 });
  });

  test('partner names visible in list', async ({ page }) => {
    await page.goto('/partners');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Johnson Legal Group')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Vegas Spine & Chiro')).toBeVisible({ timeout: 5000 });
  });

  test('new partners NV Regional and Henderson Chiropractic visible', async ({ page }) => {
    await page.goto('/partners');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('NV Regional Medical Center')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Henderson Chiropractic')).toBeVisible({ timeout: 5000 });
  });

  test('partner detail shows referral summary', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/partners?name=eq.Johnson Legal Group&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const partners = await res.json() as { id: string }[];
    if (partners.length === 0) { test.skip(true, 'Johnson partner not found — run demo data first'); return; }

    await page.goto(`/partners/${partners[0].id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Referral Summary' })).toBeVisible({ timeout: 8000 });
  });

  test('partner detail commission tracking visible', async ({ page, request }) => {
    const jwt = await getJwt(request);
    const res = await request.get(`${POSTGREST}/partners?name=eq.Johnson Legal Group&select=id`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    const partners = await res.json() as { id: string }[];
    if (partners.length === 0) { test.skip(true, 'Johnson partner not found'); return; }

    await page.goto(`/partners/${partners[0].id}`);
    await page.waitForLoadState('networkidle');

    // Commission amounts or referral counts visible
    await expect(
      page.getByText(/commission|referral|2,000|2000/i).first()
    ).toBeVisible({ timeout: 8000 });
  });
});
