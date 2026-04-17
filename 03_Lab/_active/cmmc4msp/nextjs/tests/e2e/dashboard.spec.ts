/**
 * dashboard.spec.ts
 *
 * Tests for the MSP admin dashboard at /:
 * - Page loads with correct heading
 * - Summary stat cards are present
 * - Client orgs list or empty state renders
 * - "Onboard New Client" button visible and linked to /onboard
 * - Clicking an org name navigates to /{orgSlug}/dashboard
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Ensure we're on the dashboard before each test
  await expect(page.getByRole('heading', { name: 'CMMC Compliance OS' })).toBeVisible({
    timeout: 20000,
  })
})

test('main dashboard loads with CMMC Compliance OS heading', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'CMMC Compliance OS' })).toBeVisible()
  await expect(page.getByText('MSP Dashboard — All Clients')).toBeVisible()
})

test('summary stat cards are visible', async ({ page }) => {
  // The three stat cards: Total Clients, Avg SPRS Score, Assessment Ready
  await expect(page.getByText('Total Clients')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Avg SPRS Score')).toBeVisible()
  await expect(page.getByText('Assessment Ready')).toBeVisible()
})

test('"Onboard New Client" button is visible and links to /onboard', async ({ page }) => {
  const onboardBtn = page.getByRole('link', { name: /onboard new client/i })
  await expect(onboardBtn).toBeVisible({ timeout: 15000 })

  const href = await onboardBtn.getAttribute('href')
  expect(href).toBe('/onboard')
})

test('client orgs list or empty state renders after data loads', async ({ page }) => {
  // Wait for loading skeleton to disappear (data loaded when either table or empty state appears)
  await page.waitForFunction(
    () => {
      const skeleton = document.querySelector('.animate-pulse')
      return !skeleton
    },
    { timeout: 20000 }
  )

  // Either the orgs table or the empty state message should be present
  const hasTable = await page.locator('table').isVisible().catch(() => false)
  const hasEmptyState = await page
    .getByText(/no clients yet/i)
    .isVisible()
    .catch(() => false)

  expect(hasTable || hasEmptyState).toBeTruthy()
})

test('clicking an org name navigates to /{orgSlug}/dashboard', async ({ page }) => {
  // Wait for data to load
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 20000 }
  )

  // Only run the navigation assertion when there are orgs to click
  const orgLinks = page.locator('table tbody a[href*="/dashboard"]')
  const count = await orgLinks.count()

  if (count === 0) {
    // No orgs seeded — skip navigation assertion but verify empty state
    await expect(page.getByText(/no clients yet/i)).toBeVisible()
    return
  }

  const firstLink = orgLinks.first()
  const href = await firstLink.getAttribute('href')
  expect(href).toMatch(/^\/[a-z0-9-]+\/dashboard$/)

  await firstLink.click()
  await page.waitForURL(/\/[a-z0-9-]+\/dashboard/, { timeout: 15000 })
  // Dashboard page for the org should load — it shows the org name as heading
  await expect(page.locator('h1')).toBeVisible({ timeout: 15000 })
})
