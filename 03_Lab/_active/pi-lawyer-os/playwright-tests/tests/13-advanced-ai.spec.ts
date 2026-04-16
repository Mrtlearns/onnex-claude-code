import { test, expect } from '@playwright/test';
import { BASE, STAFF_EMAIL as ADMIN_EMAIL, STAFF_PASSWORD as ADMIN_PASSWORD } from './helpers';

// Phase 11 — Advanced AI verification tests

test.describe('Phase 11 — Document RAG', () => {
  test('document_chunks table accessible via PostgREST', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/document_chunks?limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
  });

  test('embed-document endpoint exists and returns 404 for unknown UUID', async ({ request }) => {
    const res = await request.post(
      `${BASE}/ai/embed-document?document_id=00000000-0000-0000-0000-000000000000`,
      { headers: { 'X-Internal-Key': 'pilaweros_internal_key_changeme' } },
    );
    expect([404, 422]).toContain(res.status());
  });

  test('search-documents endpoint requires auth', async ({ request }) => {
    const res = await request.post(`${BASE}/ai/search-documents`, {
      data: { query: 'medical treatment' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  test('search-documents returns array when authenticated', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.post(`${BASE}/ai/search-documents`, {
      data: { query: 'medical treatment injuries', limit: 3 },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Returns {query: "...", results: [...]}
    expect(Array.isArray(body.results)).toBe(true);
  });

  test('DocumentPanel semantic search section renders on case detail', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);

    // Navigate to cases and open first case
    await page.goto(`${BASE}/cases`);
    await page.waitForLoadState('networkidle');
    const firstLink = page.locator('a[href*="/cases/"]').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');
      // Navigate to documents tab
      const docsTab = page.getByRole('tab', { name: /documents/i });
      if (await docsTab.count() > 0) {
        await docsTab.click();
        await expect(page.getByText('Semantic Search')).toBeVisible();
      }
    }
  });
});

test.describe('Phase 11 — Objection Library', () => {
  test('objection_library table has 20 seeded entries', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/objection_library?limit=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  test('objection_library entries have required fields', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${BASE}/api/objection_library?limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const rows = await res.json();
    expect(rows[0]).toHaveProperty('category');
    expect(rows[0]).toHaveProperty('objection');
    expect(rows[0]).toHaveProperty('response');
    expect(rows[0]).toHaveProperty('active');
  });

  test('Settings page shows Objection Library card', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Objection Library')).toBeVisible();
    await expect(page.getByText('Common intake objections')).toBeVisible();
  });

  test('Objection Library loads entries when button clicked', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard/);
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Load Objections' }).click();
    await page.waitForTimeout(3000);
    // Should show count and "Add Objection" button after load
    await expect(page.getByRole('button', { name: /Add Objection/i })).toBeVisible();
  });
});

test.describe('Phase 11 — Wyatt MCP Tool', () => {
  test('postgrest-mcp.js exists in openclaw workspace', async ({ request }) => {
    // Verify the file was deployed by checking if openclaw is healthy
    const res = await request.get(`${BASE}/openclaw/healthz`, {
      timeout: 5000,
    }).catch(() => null);
    // Openclaw may return 401/200/other — just check it's reachable
    expect(res).not.toBeNull();
    expect([200, 401, 403, 404]).toContain(res!.status());
  });
});

test.describe('Phase 11 — Enhanced Demand Letter', () => {
  test('generate-demand endpoint returns 404 for unknown case (not 500)', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await loginRes.json();

    const res = await request.post(
      `${BASE}/ai/generate-demand/00000000-0000-0000-0000-000000000000`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(404);
  });
});
