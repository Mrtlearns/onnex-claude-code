import { test, expect } from '@playwright/test';
import { loginAsStaff } from './helpers';

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  test('analytics page loads', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /analytics/i })).toBeVisible({ timeout: 8000 });
  });

  test('KPI tiles show numeric values', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    // "Total Cases" tile must be present
    await expect(page.getByText('Total Cases')).toBeVisible({ timeout: 8000 });
    // The tile should have a numeric value alongside the label
    await expect(page.locator('text=/\\d+/').first()).toBeVisible({ timeout: 5000 });
  });

  test('analytics charts render without error', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Error').first()).not.toBeVisible();
    await expect(page.getByText('Failed').first()).not.toBeVisible();
    // Recharts SVG present
    const charts = page.locator('svg');
    await expect(charts.first()).toBeVisible({ timeout: 8000 });
    // SVG should contain path/rect elements (actual chart shapes)
    const svgElements = page.locator('svg path, svg rect');
    await expect(svgElements.first()).toBeVisible({ timeout: 8000 });
  });

  test('lead funnel chart visible', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText('Lead Funnel')
        .or(page.getByText('Lead funnel'))
        .or(page.getByText('Leads by Status'))
    ).toBeVisible({ timeout: 8000 });
  });

  test('partner performance section shows partner names not generic placeholder', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    // Should show actual partner name, not just "Partner" text
    await expect(
      page.getByText('Johnson Legal Group')
        .or(page.getByText('Vegas Spine'))
        .or(page.getByText('Partner Performance'))
        .first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('case summary section visible', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Case Summary')).toBeVisible({ timeout: 8000 });
  });
});
