import { test, expect } from '@playwright/test';
import { BASE, STAFF_EMAIL as ADMIN_EMAIL, STAFF_PASSWORD as ADMIN_PASSWORD } from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getJwt(request: import('@playwright/test').APIRequestContext): Promise<{ token: string; firmId: string }> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  return { token: body.token as string, firmId: body.firm?.id as string };
}

async function loginAndGoToSettings(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`);
  // Use CSS selectors (same as loginAsStaff helper) — more robust than getByRole/getByLabel on login
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');
}

// Expand a named integration row and wait for the panel to be visible.
// Uses .rounded-lg to scope to individual rows (Card uses rounded-xl, rows use rounded-lg).
async function expandIntegration(page: import('@playwright/test').Page, name: string) {
  const row = page.locator('.border.border-gray-200.rounded-lg').filter({ hasText: name }).first();
  const panel = row.locator('.bg-gray-50');
  if (!(await panel.isVisible())) {
    await row.locator('button').first().click();
    await panel.waitFor({ state: 'visible', timeout: 5000 });
  }
  return row;
}

// ---------------------------------------------------------------------------
// API / Backend tests
// ---------------------------------------------------------------------------
test.describe('Integrations — DB & API', () => {
  test('firms table has integrations_config column', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.get(`${BASE}/api/firms?select=id,integrations_config&limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('integrations_config');
  });

  test('integrations_config is a JSONB object (not null)', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.get(`${BASE}/api/firms?select=integrations_config&limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const rows = await res.json();
    expect(typeof rows[0].integrations_config).toBe('object');
    expect(rows[0].integrations_config).not.toBeNull();
  });

  test('PATCH firms saves integrations_config successfully', async ({ request }) => {
    const { token, firmId } = await getJwt(request);
    const payload = {
      integrations_config: {
        twilio: {
          enabled: true,
          fields: { account_sid: 'ACtest123', auth_token: 'tok_test', phone_number: '+15551234567' },
        },
      },
    };
    const res = await request.patch(`${BASE}/api/firms?id=eq.${firmId}`, {
      data: payload,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows[0].integrations_config).toHaveProperty('twilio');
    expect(rows[0].integrations_config.twilio.fields.account_sid).toBe('ACtest123');
  });

  test('PATCH firms merges into existing integrations_config', async ({ request }) => {
    const { token, firmId } = await getJwt(request);
    await request.patch(`${BASE}/api/firms?id=eq.${firmId}`, {
      data: { integrations_config: { zapier: { enabled: true, fields: { webhook_url: 'https://hooks.zapier.com/test1' } } } },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    });
    const getRes = await request.get(`${BASE}/api/firms?id=eq.${firmId}&select=integrations_config`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const existing = (await getRes.json())[0].integrations_config;
    const merged = { ...existing, sendgrid: { enabled: true, fields: { api_key: 'SG.test', from_email: 'test@firm.com', from_name: 'Firm' } } };
    await request.patch(`${BASE}/api/firms?id=eq.${firmId}`, {
      data: { integrations_config: merged },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    });
    const checkRes = await request.get(`${BASE}/api/firms?id=eq.${firmId}&select=integrations_config`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const config = (await checkRes.json())[0].integrations_config;
    expect(config).toHaveProperty('zapier');
    expect(config).toHaveProperty('sendgrid');
  });
});

// ---------------------------------------------------------------------------
// test-integration endpoint tests
// ---------------------------------------------------------------------------
test.describe('Integrations — test-integration endpoint', () => {
  test('POST /auth/test-integration requires authentication', async ({ request }) => {
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'zapier', credentials: { webhook_url: 'https://hooks.zapier.com/test' } },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('Zapier with valid hooks.zapier.com URL returns success', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'zapier', credentials: { webhook_url: 'https://hooks.zapier.com/hooks/catch/123/abc' } },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/valid/i);
  });

  test('Zapier with invalid URL returns failure', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'zapier', credentials: { webhook_url: 'https://not-zapier.com/evil' } },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('Zapier with missing webhook_url returns failure', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'zapier', credentials: {} },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  test('DocuSign (OAuth-only) with all fields returns fields-complete message', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: {
        integration: 'docusign',
        credentials: {
          integration_key: 'abc', secret_key: 'xyz',
          account_id: '123', base_uri: 'https://na4.docusign.net',
        },
      },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/oauth/i);
  });

  test('QuickBooks (OAuth-only) returns fields-complete message', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: {
        integration: 'quickbooks',
        credentials: { client_id: 'cid', client_secret: 'csec', realm_id: '123', access_token: 'at', refresh_token: 'rt' },
      },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/oauth/i);
  });

  test('Clio (OAuth-only) returns fields-complete message', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: {
        integration: 'clio',
        credentials: { client_id: 'cid', client_secret: 'csec', access_token: 'at', refresh_token: 'rt' },
      },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('Twilio with missing fields returns failure', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'twilio', credentials: { account_sid: 'ACtest' } },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  test('SendGrid with missing api_key returns failure', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'sendgrid', credentials: { from_email: 'test@firm.com' } },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('Dropbox Sign with empty credentials returns failure', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'dropbox_sign', credentials: {} },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('Unknown integration slug returns failure', async ({ request }) => {
    const { token } = await getJwt(request);
    const res = await request.post(`${BASE}/auth/test-integration`, {
      data: { integration: 'nonexistent_slug', credentials: {} },
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UI tests
// ---------------------------------------------------------------------------
test.describe('Integrations — Settings UI', () => {
  test('Settings page has Integrations card heading and description', async ({ page }) => {
    await loginAndGoToSettings(page);
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    await expect(page.getByText('Connect PI Lawyer OS to your existing software stack.')).toBeVisible();
  });

  test('all 5 category group labels are visible', async ({ page }) => {
    await loginAndGoToSettings(page);
    // Labels use CSS uppercase — match case-insensitively
    for (const label of ['E-Signature', 'Payments & Accounting', 'Communications', 'Scheduling', 'Case Management']) {
      await expect(page.getByText(new RegExp(`^${label}$`, 'i'))).toBeVisible();
    }
  });

  test('all 12 integration names visible in collapsed state', async ({ page }) => {
    await loginAndGoToSettings(page);
    const integrations = [
      'DocuSign', 'Dropbox Sign',
      'LawPay', 'QuickBooks Online',
      'Twilio', 'SendGrid', 'RingCentral',
      'Calendly', 'Zapier',
      'Filevine', 'Clio Manage', 'MyCase',
    ];
    for (const name of integrations) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
  });

  test('expanding DocuSign reveals description and all 4 fields', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'DocuSign');
    await expect(row.getByText('Send retainer agreements')).toBeVisible();
    await expect(row.locator('#docusign-integration_key')).toBeVisible();
    await expect(row.locator('#docusign-secret_key')).toBeVisible();
    await expect(row.locator('#docusign-account_id')).toBeVisible();
    await expect(row.locator('#docusign-base_uri')).toBeVisible();
  });

  test('expanding Zapier shows field, Save and Test Connection buttons', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Zapier');
    await expect(row.locator('#zapier-webhook_url')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Test Connection' })).toBeVisible();
  });

  test('how-to toggle expands inline note and shows docs link', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Twilio');
    await row.getByText(/How to get these credentials/).click();
    await expect(row.getByText(/console.twilio.com/i)).toBeVisible();
    await expect(row.getByRole('link', { name: /Official Docs/i })).toBeVisible();
  });

  test('docs link opens in new tab and has rel=noopener', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Twilio');
    await row.getByText(/How to get these credentials/).click();
    const docsLink = row.getByRole('link', { name: /Official Docs/i });
    await expect(docsLink).toHaveAttribute('target', '_blank');
    await expect(docsLink).toHaveAttribute('rel', /noopener/);
  });

  test('password fields render as type=password', async ({ page }) => {
    await loginAndGoToSettings(page);
    await expandIntegration(page, 'Twilio');
    await expect(page.locator('#twilio-auth_token')).toHaveAttribute('type', 'password');
  });

  test('eye toggle reveals password field content', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Twilio');
    const authTokenInput = row.locator('#twilio-auth_token');
    await authTokenInput.fill('mysecrettoken');
    // Eye toggle button is sibling of the input inside the relative div
    const eyeBtn = row.locator('#twilio-auth_token').locator('xpath=following-sibling::button');
    await eyeBtn.click();
    await expect(authTokenInput).toHaveAttribute('type', 'text');
  });

  test('fill Zapier webhook URL and Save → shows saved confirmation', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Zapier');
    await row.locator('#zapier-webhook_url').fill('https://hooks.zapier.com/hooks/catch/99/savetest');
    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row.getByText('Credentials saved.')).toBeVisible({ timeout: 8000 });
  });

  test('Zapier collapsed badge shows Saved after saving', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Zapier');
    await row.locator('#zapier-webhook_url').fill('https://hooks.zapier.com/hooks/catch/99/badgetest');
    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row.getByText('Credentials saved.')).toBeVisible({ timeout: 8000 });
    // Collapse by clicking the row header button
    await row.locator('button').first().click();
    // Badge should now show Saved
    await expect(row.locator('span').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 5000 });
  });

  test('Test Connection on Zapier with valid URL shows success message', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'Zapier');
    await row.locator('#zapier-webhook_url').fill('https://hooks.zapier.com/hooks/catch/99/conntest');
    await row.getByRole('button', { name: 'Test Connection' }).click();
    await expect(row.getByText(/valid/i)).toBeVisible({ timeout: 10000 });
  });

  test('Test Connection on DocuSign shows OAuth authorization message', async ({ page }) => {
    await loginAndGoToSettings(page);
    const row = await expandIntegration(page, 'DocuSign');
    await row.locator('#docusign-integration_key').fill('abc123');
    await row.locator('#docusign-secret_key').fill('secret');
    await row.locator('#docusign-account_id').fill('acct123');
    await row.locator('#docusign-base_uri').fill('https://na4.docusign.net');
    await row.getByRole('button', { name: 'Test Connection' }).click();
    await expect(row.getByText(/oauth/i)).toBeVisible({ timeout: 10000 });
  });

  test('saved credentials persist after page reload', async ({ page }) => {
    await loginAndGoToSettings(page);
    const uniqueUrl = 'https://hooks.zapier.com/hooks/catch/88/persisttest';
    const row = await expandIntegration(page, 'Zapier');
    await row.locator('#zapier-webhook_url').fill(uniqueUrl);
    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row.getByText('Credentials saved.')).toBeVisible({ timeout: 8000 });

    // Reload and verify value is pre-populated
    await page.reload();
    await page.waitForLoadState('networkidle');
    const rowAfter = await expandIntegration(page, 'Zapier');
    await expect(rowAfter.locator('#zapier-webhook_url')).toHaveValue(uniqueUrl, { timeout: 6000 });
  });
});
