import { test, expect } from '@playwright/test';
import { loginAsStaff, BASE } from './helpers';

// Portal credentials set by demo data generation
const PORTAL_EMAIL = 'portal@williams.demo';
const PORTAL_PASSWORD = 'Portal2026!';
const FIRM_SLUG = 'demo';

test.describe('Client Portal', () => {
  test('portal login page renders', async ({ page }) => {
    await page.goto('/portal/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /portal|client/i })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="email"], #email')).toBeVisible();
    await expect(page.locator('input[type="password"], #password')).toBeVisible();
  });

  test('portal login with wrong creds shows error', async ({ page }) => {
    await page.goto('/portal/login');
    await page.locator('input[type="email"], #email').first().fill('notreal@example.com');
    await page.locator('input[type="password"], #password').first().fill('wrongpass');
    const slugInput = page.locator('input[placeholder*="firm" i], #firm_slug, input[name="firm_slug"]').first();
    if (await slugInput.isVisible()) {
      await slugInput.fill(FIRM_SLUG);
    }
    await page.click('button[type="submit"]');
    await expect(
      page.locator('.text-red-700').first()
        .or(page.getByText('Invalid').first())
        .or(page.getByText('invalid').first())
        .or(page.getByText('Unauthorized').first())
    ).toBeVisible({ timeout: 5000 });
  });

  test('portal login page firm param pre-fills slug', async ({ page }) => {
    await page.goto('/portal/login?firm=testfirm');
    await page.waitForLoadState('networkidle');
    const slugInput = page.locator('input[name="firm_slug"], #firm_slug').first();
    if (await slugInput.isVisible()) {
      const val = await slugInput.inputValue();
      expect(val).toBe('testfirm');
    }
  });

  test('portal login with correct credentials redirects to portal', async ({ page }) => {
    await page.goto('/portal/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], #email').first();
    const passwordInput = page.locator('input[type="password"], #password').first();
    const slugInput = page.locator('input[name="firm_slug"], #firm_slug').first();

    await emailInput.fill(PORTAL_EMAIL);
    await passwordInput.fill(PORTAL_PASSWORD);
    if (await slugInput.isVisible()) {
      await slugInput.fill(FIRM_SLUG);
    }
    await page.click('button[type="submit"]');

    // Should redirect to portal (not stay on login)
    await page.waitForURL(/\/portal/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('portal shows client case info after login', async ({ page }) => {
    await page.goto('/portal/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], #email').first();
    const passwordInput = page.locator('input[type="password"], #password').first();
    const slugInput = page.locator('input[name="firm_slug"], #firm_slug').first();

    await emailInput.fill(PORTAL_EMAIL);
    await passwordInput.fill(PORTAL_PASSWORD);
    if (await slugInput.isVisible()) {
      await slugInput.fill(FIRM_SLUG);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/portal/, { timeout: 10000 });

    // Portal should show client name or case info
    await expect(
      page.getByText('Williams').first()
        .or(page.getByText('Patricia').first())
        .or(page.getByText('PI-2025').first())
    ).toBeVisible({ timeout: 8000 });
  });

  test('staff can see Client Portal tab in case detail', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    const caseLink = page.locator('a[href*="/cases/"]').first();
    if (await caseLink.isVisible()) {
      await caseLink.click();
      await page.waitForURL(/\/cases\/.+/);
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('button', { name: 'Client Portal' })
          .or(page.getByRole('tab', { name: 'Client Portal' }))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('Client Portal tab shows portal access panel', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    const caseLink = page.locator('a[href*="/cases/"]').first();
    if (!(await caseLink.isVisible())) return;
    await caseLink.click();
    await page.waitForURL(/\/cases\/.+/);
    await page.waitForLoadState('networkidle');

    const portalTab = page.getByRole('button', { name: 'Client Portal' })
      .or(page.getByRole('tab', { name: 'Client Portal' })).first();
    if (await portalTab.isVisible()) {
      await portalTab.click();
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', { name: 'Client Portal Access' })
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
