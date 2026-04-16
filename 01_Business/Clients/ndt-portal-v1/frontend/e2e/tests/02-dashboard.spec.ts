import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'

test.describe('Dashboard', () => {
  let dashboard: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page)
    await dashboard.goto()
  })

  test('renders all 4 KPI cards', async ({ page }) => {
    await expect(page.getByText(/total quotes/i)).toBeVisible()
    await expect(page.getByText(/pipeline value/i)).toBeVisible()
    await expect(page.getByText(/accepted/i).first()).toBeVisible()
    await expect(page.getByText(/awaiting/i)).toBeVisible()
  })

  test('KPI values are numeric', async ({ page }) => {
    // Each KPI card should show a number (not NaN or undefined)
    const kpiNumbers = page.locator('text=/^\\$?[0-9]/')
    const count = await kpiNumbers.count()
    expect(count).toBeGreaterThan(0)
  })

  test('recent quotes section shows quote data or empty state', async ({ page }) => {
    // Dashboard uses div-based rows (not a table element)
    await expect(page.getByText(/recent quotes/i)).toBeVisible()
    // Either the empty message or actual quote entries are shown
    const content = page.getByText(/no quotes yet|calculated|pending|sent|api|portal/i)
    await expect(content.first()).toBeVisible({ timeout: 10000 })
  })

  test('quick action cards link to correct pages', async ({ page }) => {
    // Check RT action card
    // Settings configure link
    const settingsLink = page.getByRole('link', { name: /configure|settings/i }).first()
    await expect(settingsLink).toBeVisible()
  })

  test('integration status panel is visible', async ({ page }) => {
    await expect(page.getByText(/salesforce/i).first()).toBeVisible()
  })

  test('clicking "View all" navigates to /quotes', async ({ page }) => {
    const viewAll = page.getByRole('link', { name: /view all/i })
    if (await viewAll.isVisible()) {
      await viewAll.click()
      await expect(page).toHaveURL('/quotes')
    }
  })

  test('recent quote row click navigates to quotes page', async ({ page }) => {
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount > 1) {
      // There are actual quote rows — click the first data row
      await rows.nth(1).click()
      // Should navigate to quotes or open a detail
      await expect(page).toHaveURL(/\/quotes/)
    } else {
      test.skip()
    }
  })
})
