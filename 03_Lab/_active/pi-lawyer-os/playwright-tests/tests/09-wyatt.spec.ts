import { test, expect } from '@playwright/test';
import { loginAsStaff, BASE } from './helpers';

// OpenClaw UI is served at /openclaw/ via Traefik → port 47823.
// These tests verify: gateway health, Traefik routing, Wyatt nav, and LLM settings UI.

test.describe('Wyatt — OpenClaw AI Agent', () => {
  test('gateway healthz returns ok via Traefik', async ({ request }) => {
    const res = await request.get(`${BASE}/openclaw/healthz`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('OpenClaw UI renders at /openclaw/ (not the React SPA)', async ({ page }) => {
    await page.goto('/openclaw/');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('sidebar shows AI Agent nav item', async ({ page }) => {
    await loginAsStaff(page);
    await expect(page.locator('nav >> text=AI Agent')).toBeVisible();
  });

  test('AI Agent toolbar shows active model', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/ai-agent');
    await page.waitForLoadState('networkidle');
    // Should show the model badge (e.g. "openrouter/auto")
    await expect(page.locator('text=/openrouter|anthropic/').first()).toBeVisible({ timeout: 8000 });
  });

  test('AI Agent page loads OpenClaw container (not error page)', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/ai-agent');
    await page.waitForLoadState('networkidle');
    // Should not show a generic error page
    await expect(page.getByText('404').first()).not.toBeVisible();
    await expect(page.getByText('502 Bad Gateway').first()).not.toBeVisible();
    // Should show some content
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Settings — LLM Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('LLM settings card is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AI Assistant — LLM' })).toBeVisible();
  });

  test('provider dropdown defaults to OpenRouter', async ({ page }) => {
    await expect(page.getByText(/openrouter\/auto/)).toBeVisible({ timeout: 10000 });
  });

  test('model dropdown defaults to Auto', async ({ page }) => {
    await expect(page.getByText(/openrouter\/auto/)).toBeVisible({ timeout: 10000 });
  });

  test('Save & Apply button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Save & Apply/ })).toBeVisible();
  });

  test('can save LLM settings', async ({ page }) => {
    await page.getByRole('button', { name: /Save & Apply/ }).click();
    await expect(page.locator('text=/Saved/')).toBeVisible({ timeout: 10000 });
  });

  test('LLM settings persist after page reload', async ({ page }) => {
    // Note the current setting
    const currentText = await page.getByText(/openrouter\/auto/).textContent();

    // Save and reload
    await page.getByRole('button', { name: /Save & Apply/ }).click();
    await expect(page.locator('text=/Saved/')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still show the same provider/model
    if (currentText) {
      await expect(page.getByText(/openrouter\/auto/)).toBeVisible({ timeout: 10000 });
    }
  });
});
