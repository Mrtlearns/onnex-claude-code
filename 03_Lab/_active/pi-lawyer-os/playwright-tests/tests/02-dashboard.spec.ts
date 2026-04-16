import { test, expect } from '@playwright/test';
import { loginAsStaff } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test('KPI cards load without error and show numeric values', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Failed to load')).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Speed to Lead')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Missed Call Recovery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Leads' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Intake Completion' })).toBeVisible();
    // At least one numeric value on the KPI cards
    await expect(page.locator('text=/\\d+%|\\d+ min/').first()).toBeVisible({ timeout: 8000 });
  });

  test('Leads by Status chart renders with SVG content', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Leads by Status')).toBeVisible();
    // SVG chart should have actual path/arc elements (donut segments)
    const svgPaths = page.locator('svg path');
    await expect(svgPaths.first()).toBeVisible({ timeout: 8000 });
  });

  test('SOL alerts section visible', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    // SOL section appears on dashboard with demo data
    await expect(
      page.getByText('SOL').first()
        .or(page.getByText('Statute of Limitations').first())
        .or(page.getByText('Harrison').first())
    ).toBeVisible({ timeout: 8000 });
  });

  test('Automations section visible', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Automations/i })).toBeVisible();
    await expect(page.getByText('Speed-to-lead').first()).toBeVisible();
  });

  test('sidebar navigation items all present', async ({ page }) => {
    const navItems = ['Dashboard', 'Leads', 'Cases', 'Partners', 'Analytics', 'Settings'];
    for (const item of navItems) {
      await expect(page.locator(`nav >> text=${item}`)).toBeVisible();
    }
  });

  test('sidebar nav Leads link navigates to /leads', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.locator('nav >> text=Leads').first().click();
    await expect(page).toHaveURL(/\/leads/);
  });
});
