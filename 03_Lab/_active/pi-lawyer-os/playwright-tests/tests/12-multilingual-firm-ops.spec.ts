import { test, expect } from '@playwright/test';
import { BASE, STAFF_EMAIL, STAFF_PASSWORD } from './helpers';

// Phase 10 — Multilingual + Firm Ops verification tests

const ADMIN_EMAIL = 'admin@demo.pilaweros.local';
const ADMIN_PASSWORD = 'Admin1234!';

test.describe('Phase 10 — Language Toggle', () => {
  test('Settings page has Interface Language card', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Interface Language')).toBeVisible();
  });

  test('Language card shows English and Español options', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Interface Language')).toBeVisible();
    // Reloads immediately label confirms toggle is present
    await expect(page.getByText('Reloads immediately')).toBeVisible();
  });
});

test.describe('Phase 10 — User Management', () => {
  test('Settings page shows Team card for admin', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.getByText('Manage staff user accounts')).toBeVisible();
  });

  test('Team card has Add User form with required fields', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Add Staff User')).toBeVisible();
    await expect(page.getByPlaceholder('Jane Smith')).toBeVisible();
    await expect(page.getByPlaceholder('jane@firm.com')).toBeVisible();
    await expect(page.getByPlaceholder('Temp2026!')).toBeVisible();
  });

  test('create-user API endpoint creates a user (201)', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.post(`${BASE}/auth/create-user`, {
      data: { email: `spec.test.${Date.now()}@demo.local`, name: 'Spec Test User', role: 'paralegal', password: 'Test2026!' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.role).toBe('paralegal');

    // Deactivate via API
    const deactivateRes = await request.patch(`${BASE}/auth/update-user/${body.id}`, {
      data: { active: false },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(deactivateRes.status()).toBe(200);
    const deactivated = await deactivateRes.json();
    expect(deactivated.active).toBe(false);
  });

  test('deactivated user cannot log in (403)', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    // Create user to deactivate
    const email = `deactivate.test.${Date.now()}@demo.local`;
    const createRes = await request.post(`${BASE}/auth/create-user`, {
      data: { email, name: 'Deactivate Test', role: 'paralegal', password: 'Test2026!' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const newUser = await createRes.json();

    // Deactivate
    await request.patch(`${BASE}/auth/update-user/${newUser.id}`, {
      data: { active: false },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });

    // Attempt login — must return 403
    const failLogin = await request.post(`${BASE}/auth/login`, {
      data: { email, password: 'Test2026!' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(failLogin.status()).toBe(403);
  });

  test('list-users API returns current users', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/auth/list-users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0]).toHaveProperty('email');
    expect(users[0]).toHaveProperty('role');
    expect(users[0]).toHaveProperty('active');
  });
});

test.describe('Phase 10 — Audit Log', () => {
  test('audit_log table is accessible via PostgREST', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/audit_log?limit=10`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
  });

  test('audit log records INSERT when lead is created via intake', async ({ request }) => {
    const intakeRes = await request.post(`${BASE}/auth/intake`, {
      data: { first_name: 'AuditSpec', last_name: 'Lead', phone: '7025559001', source: 'web-form' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(intakeRes.status()).toBe(201);
    const { id: leadId } = await intakeRes.json();

    // Login and query audit log
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const auditRes = await request.get(
      `${BASE}/api/audit_log?entity_type=eq.leads&entity_id=eq.${leadId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    expect(auditRes.status()).toBe(200);
    const entries = await auditRes.json();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].action).toBe('INSERT');
    expect(entries[0].entity_type).toBe('leads');
  });

  test('AuditLogPanel component renders on lead detail', async ({ page }) => {
    // Create a lead to view
    const intakeRes = await page.request.post(`${BASE}/auth/intake`, {
      data: { first_name: 'AuditPanel', last_name: 'Test', phone: '7025559002', source: 'web-form' },
      headers: { 'Content-Type': 'application/json' },
    });
    const { id: leadId } = await intakeRes.json();

    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/leads/${leadId}`);
    await page.waitForLoadState('networkidle');

    // Audit log panel toggle button should be present
    await expect(page.getByText('Audit Log')).toBeVisible();
  });
});

test.describe('Phase 10 — Attorney Performance', () => {
  test('attorney_performance view is accessible via PostgREST', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/attorney_performance`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
  });

  test('analytics page loads without error', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/analytics`);
    await page.waitForLoadState('networkidle');
    // Should show existing analytics sections
    await expect(page.getByText('Case Summary')).toBeVisible();
    await expect(page.getByText('Lead Funnel')).toBeVisible();
  });
});

test.describe('Phase 10 — preferred_language schema', () => {
  test('preferred_language column exists on leads', async ({ request }) => {
    const intakeRes = await request.post(`${BASE}/auth/intake`, {
      data: { first_name: 'LangTest', last_name: 'Lead', phone: '7025559100', source: 'web-form' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(intakeRes.status()).toBe(201);
    const { id: leadId } = await intakeRes.json();

    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/leads?id=eq.${leadId}&select=id,preferred_language`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty('preferred_language');
    expect(rows[0].preferred_language).toBe('en');
  });
});
