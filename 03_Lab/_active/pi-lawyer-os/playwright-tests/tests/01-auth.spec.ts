import { test, expect } from '@playwright/test';
import { loginAsStaff, STAFF_EMAIL, STAFF_PASSWORD } from './helpers';

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('PI Lawyer OS');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@email.com');
    await page.fill('#password', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('.text-red-700, [class*="red"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('valid login redirects to dashboard', async ({ page }) => {
    await loginAsStaff(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('root redirect works when authenticated', async ({ page }) => {
    await loginAsStaff(page);
    await page.goto('/');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('protected routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
