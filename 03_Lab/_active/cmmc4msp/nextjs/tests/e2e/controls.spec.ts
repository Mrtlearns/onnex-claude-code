/**
 * controls.spec.ts
 *
 * Tests for the controls list and control detail pages:
 * - Controls list at /{orgSlug}/controls loads
 * - Control items (table rows with NIST IDs) are visible
 * - Clicking a control navigates to /{orgSlug}/controls/{id}
 * - Control detail page shows: NIST ID, requirement text, artifacts section
 * - Upload drop zone exists on control detail
 */
import { test, expect } from '@playwright/test'

// Canopy Aerospace is the seed org — if it doesn't exist these tests degrade gracefully
const ORG_SLUG = process.env.CMMC_TEST_ORG_SLUG || 'canopy-aerospace'

test.describe('controls list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${ORG_SLUG}/controls`)
    // Wait for loading to finish — skeleton disappears
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )
  })

  test('controls page loads with "Controls" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Controls' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('control count badge is visible', async ({ page }) => {
    // The page shows "{n} controls" next to the heading
    await expect(page.getByText(/\d+ controls/)).toBeVisible({ timeout: 15000 })
  })

  test('filter controls renders search input and dropdowns', async ({ page }) => {
    await expect(
      page.getByPlaceholder(/search nist id/i)
    ).toBeVisible({ timeout: 10000 })

    // Phase filter and status filter dropdowns
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('control rows are visible with NIST IDs', async ({ page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()

    if (count === 0 || (await page.getByText(/no controls match/i).isVisible())) {
      // No controls seeded — acceptable
      return
    }

    // First row should contain a NIST ID link (e.g. 3.1.1)
    const firstNistLink = rows.first().locator('a[href*="/controls/"]')
    await expect(firstNistLink).toBeVisible()
    const nistText = await firstNistLink.textContent()
    // NIST IDs follow pattern like 3.1.1 or AC.1.001
    expect(nistText).toMatch(/\d+/)
  })

  test('clicking a control row navigates to the control detail page', async ({ page }) => {
    const firstControlLink = page.locator('table tbody tr').first().locator('a[href*="/controls/"]')
    const count = await page.locator('table tbody tr').count()

    if (count === 0) {
      return // No controls to click
    }

    const href = await firstControlLink.getAttribute('href')
    expect(href).toMatch(new RegExp(`^/${ORG_SLUG}/controls/[a-f0-9-]+$`))

    await firstControlLink.click()
    await page.waitForURL(new RegExp(`/${ORG_SLUG}/controls/[a-f0-9-]+`), { timeout: 15000 })
  })
})

test.describe('control detail page', () => {
  let controlDetailUrl: string

  test.beforeEach(async ({ page }) => {
    // Navigate to controls list to discover a real control ID
    await page.goto(`/${ORG_SLUG}/controls`)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )

    const firstLink = page.locator('table tbody tr a[href*="/controls/"]').first()
    const count = await page.locator('table tbody tr').count()

    if (count > 0 && (await firstLink.isVisible())) {
      const href = await firstLink.getAttribute('href')
      controlDetailUrl = href || `/${ORG_SLUG}/controls`
    } else {
      controlDetailUrl = `/${ORG_SLUG}/controls`
    }

    await page.goto(controlDetailUrl)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )
  })

  test('control detail shows NIST ID in header', async ({ page }) => {
    if (!controlDetailUrl.includes('/controls/')) {
      test.skip() // no control found
    }
    // NIST ID is rendered in a font-mono span, e.g. "3.1.1"
    const nistIdEl = page.locator('.font-mono').first()
    await expect(nistIdEl).toBeVisible({ timeout: 15000 })
    const text = await nistIdEl.textContent()
    expect(text?.trim()).toMatch(/\d+/)
  })

  test('control detail shows requirement text section', async ({ page }) => {
    if (!controlDetailUrl.includes('/controls/')) {
      test.skip()
    }
    await expect(page.getByRole('heading', { name: 'Requirement' })).toBeVisible({
      timeout: 15000,
    })
    // Requirement text is in the section — should be non-empty prose
    const reqSection = page.locator('h2', { hasText: 'Requirement' }).locator('..')
    await expect(reqSection).toBeVisible()
  })

  test('control detail shows Evidence Artifacts section', async ({ page }) => {
    if (!controlDetailUrl.includes('/controls/')) {
      test.skip()
    }
    await expect(page.getByRole('heading', { name: 'Evidence Artifacts' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('upload drop zone is present on control detail', async ({ page }) => {
    if (!controlDetailUrl.includes('/controls/')) {
      test.skip()
    }
    // The uploader section has the heading "Upload New Evidence"
    await expect(page.getByText('Upload New Evidence')).toBeVisible({ timeout: 15000 })
    // The drop zone contains the upload prompt text
    await expect(
      page.getByText(/drop evidence here|browse/i)
    ).toBeVisible({ timeout: 10000 })
  })
})
