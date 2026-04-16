import { test, expect } from '@playwright/test';
import { BASE, STAFF_EMAIL as ADMIN_EMAIL, STAFF_PASSWORD as ADMIN_PASSWORD } from './helpers';

// Phase 12 — Platform Scale verification tests

test.describe('Phase 12 — Firm Branding Schema', () => {
  test('firms table has logo_url, primary_color, sms_signature columns', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/firms?select=id,primary_color,sms_signature,logo_url&limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('primary_color');
    expect(rows[0]).toHaveProperty('sms_signature');
    expect(rows[0]).toHaveProperty('logo_url');
  });

  test('login response includes firm branding fields', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body).toHaveProperty('firm');
    expect(body.firm).toHaveProperty('primary_color');
    expect(body.firm).toHaveProperty('sms_signature');
  });

  test('Settings page shows Firm Branding card for admin', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Firm Branding')).toBeVisible();
    await expect(page.getByText('Logo, primary color')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Branding' })).toBeVisible();
  });
});

test.describe('Phase 12 — Document Templates', () => {
  test('document_templates table has 3 seeded entries', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/document_templates?limit=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  test('document_templates entries have required fields', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/document_templates?limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const rows = await res.json();
    expect(rows[0]).toHaveProperty('template_type');
    expect(rows[0]).toHaveProperty('name');
    expect(rows[0]).toHaveProperty('content');
    expect(rows[0]).toHaveProperty('active');
  });

  test('Settings page shows Document Templates card', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Document Templates')).toBeVisible();
    await expect(page.getByText('Retainer, engagement letter')).toBeVisible();
  });

  test('Document Templates loads entries when button clicked', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Load Templates' }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: /Add Template/i })).toBeVisible();
  });
});

test.describe('Phase 12 — Stripe Schema', () => {
  test('firms table has stripe columns', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/firms?select=id,stripe_customer_id,stripe_subscription_id,subscription_status&limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows[0]).toHaveProperty('subscription_status');
  });
});
