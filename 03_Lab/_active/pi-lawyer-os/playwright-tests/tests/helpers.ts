import { Page } from '@playwright/test';

export const BASE = 'http://10.10.110.33';
export const STAFF_EMAIL = 'admin@demo.pilaweros.local';
export const STAFF_PASSWORD = 'Admin1234!';
export const PORTAL_EMAIL = 'portal@williams.demo';
export const PORTAL_PASSWORD = 'Portal2026!';
export const FIRM_SLUG = 'demo';

export async function loginAsStaff(page: Page) {
  await page.goto('/login');
  await page.fill('#email', STAFF_EMAIL);
  await page.fill('#password', STAFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function loginAsPortal(page: Page) {
  await page.goto('/portal/login');
  await page.fill('#firm_slug', FIRM_SLUG);
  await page.fill('#email', PORTAL_EMAIL);
  await page.fill('#password', PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/portal', { timeout: 10000 });
}
