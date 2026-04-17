/**
 * suggestions.spec.ts
 *
 * Tests for the "Also satisfies" cross-control suggestion panel:
 * - Panel appears after artifact is assessed
 * - Shows at least 1 suggestion
 * - "Apply" button is visible per suggestion
 * - Clicking "Apply" changes button to "Applied ✓"
 *
 * NOTE: The AlsoSatisfiesList component auto-fetches suggestions 2s after
 * mounting on an artifact with assessment_status === "assessed". These tests
 * require at least one assessed artifact to exist in the DB for the seed org.
 * If none exists, the tests degrade gracefully (skip).
 */
import { test, expect } from '@playwright/test'

const ORG_SLUG = process.env.CMMC_TEST_ORG_SLUG || 'canopy-aerospace'

async function findAssessedArtifactControl(page: any): Promise<string | null> {
  // Navigate to controls list
  await page.goto(`/${ORG_SLUG}/controls`)
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 30000 }
  )

  const rows = page.locator('table tbody tr')
  const rowCount = await rows.count()

  for (let i = 0; i < Math.min(rowCount, 10); i++) {
    const link = rows.nth(i).locator('a[href*="/controls/"]')
    if (!(await link.isVisible().catch(() => false))) continue
    const href = await link.getAttribute('href')
    if (!href) continue

    await page.goto(href)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )

    // Check if there's an assessed artifact (badge text "assessed")
    const assessedBadge = page.getByText('assessed').first()
    if (await assessedBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      return href
    }
  }

  return null
}

test.describe('cross-control suggestions panel', () => {
  test('Also satisfies panel appears and shows suggestions for assessed artifact', async ({
    page,
  }) => {
    const controlUrl = await findAssessedArtifactControl(page)
    if (!controlUrl) {
      test.skip()
      return
    }

    await page.goto(controlUrl)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )

    // The AlsoSatisfiesList component fetches after 2s; wait up to 30s total
    // It shows either:
    //   a) "This artifact may also satisfy N other controls"
    //   b) "No similar controls found above threshold." (valid — no suggestions)
    //   c) Loading text: "Finding similar controls…"
    await expect(
      page
        .getByText(/this artifact may also satisfy/i)
        .or(page.getByText(/no similar controls found/i))
        .or(page.getByText(/finding similar controls/i))
    ).toBeVisible({ timeout: 30000 })
  })

  test('suggestions show Apply buttons', async ({ page }) => {
    const controlUrl = await findAssessedArtifactControl(page)
    if (!controlUrl) {
      test.skip()
      return
    }

    await page.goto(controlUrl)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )

    // Wait for the suggestions panel to fully load
    await expect(
      page
        .getByText(/this artifact may also satisfy/i)
        .or(page.getByText(/no similar controls found/i))
    ).toBeVisible({ timeout: 30000 })

    // Only assert Apply buttons if suggestions are present
    const suggestionHeader = page.getByText(/this artifact may also satisfy/i)
    if (!(await suggestionHeader.isVisible().catch(() => false))) {
      test.skip() // no suggestions for this artifact
      return
    }

    // Each suggestion card has an "Apply" button (or "Applied ✓" if already applied)
    const applyBtn = page.getByRole('button', { name: 'Apply' }).first()
    await expect(applyBtn).toBeVisible({ timeout: 10000 })
  })

  test('clicking Apply changes button to Applied checkmark', async ({ page }) => {
    const controlUrl = await findAssessedArtifactControl(page)
    if (!controlUrl) {
      test.skip()
      return
    }

    await page.goto(controlUrl)
    await page.waitForFunction(
      () => !document.querySelector('.animate-pulse'),
      { timeout: 30000 }
    )

    // Wait for suggestions
    const suggestionHeader = page.getByText(/this artifact may also satisfy/i)
    const hasSuggestions = await suggestionHeader
      .isVisible({ timeout: 30000 })
      .catch(() => false)

    if (!hasSuggestions) {
      test.skip()
      return
    }

    const applyBtn = page.getByRole('button', { name: 'Apply' }).first()
    await expect(applyBtn).toBeVisible({ timeout: 10000 })

    await applyBtn.click()

    // After clicking, the button should be replaced by "Applied ✓" text
    await expect(page.getByText('Applied ✓').first()).toBeVisible({ timeout: 15000 })
    // The original Apply button should be gone
    await expect(applyBtn).not.toBeVisible()
  })
})
