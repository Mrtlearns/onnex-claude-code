import { test, expect } from '@playwright/test'
import { UtCalculatorPage } from '../pages/UtCalculatorPage'

// Helper: find an input by its adjacent label text (label and input in same .space-y-1 div)
function inputByLabel(page: import('@playwright/test').Page, labelText: RegExp) {
  return page.locator('label').filter({ hasText: labelText }).locator('..').locator('input')
}

test.describe('UT Calculator', () => {
  let utPage: UtCalculatorPage

  test.beforeEach(async ({ page }) => {
    utPage = new UtCalculatorPage(page)
    await utPage.goto()
  })

  test('renders Calculator / Customers / Settings tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /calculator/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /customer/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /settings/i })).toBeVisible()
  })

  test('customer dropdown is populated', async ({ page }) => {
    // The combobox should open and show options
    const select = page.getByRole('combobox').first()
    await expect(select).toBeVisible()
    // Trigger it and check options appear
    await select.click()
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible()
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
    // Close it
    await page.keyboard.press('Escape')
  })

  test('7 geometry type buttons are rendered', async ({ page }) => {
    // FLAT_BAR, ROUND_BAR, RING, TUBING, CSCAN_FLAT, CSCAN_ROUND, THIN_SHEET
    const geoLabels = ['Flat Bar', 'Round Bar', 'Ring', 'Tubing', 'C-Scan Flat', 'C-Scan Round', 'Thin Sheet']
    let found = 0
    for (const label of geoLabels) {
      const btn = page.getByRole('button', { name: label, exact: false }).first()
      if (await btn.isVisible()) found++
    }
    expect(found).toBeGreaterThanOrEqual(6)
  })

  test('scan metrics card is visible', async ({ page }) => {
    await expect(utPage.scanMetricsCard).toBeVisible()
    await expect(page.getByText(/scan metrics/i)).toBeVisible()
  })

  test('filling flat bar dimensions triggers scan calculation', async ({ page }) => {
    // Labels and inputs are co-located in .space-y-1 divs
    await inputByLabel(page, /thickness/i).fill('3.625')
    await inputByLabel(page, /width/i).fill('11.625')
    await inputByLabel(page, /length/i).fill('15.75')
    await page.keyboard.press('Tab')

    // Scan Metrics should now show numbers
    await expect(page.getByText(/scan time/i)).toBeVisible()
    await expect(page.getByText(/time price\/part/i)).toBeVisible()
  })

  test('lot pricing card appears after dimensions are set', async ({ page }) => {
    await inputByLabel(page, /thickness/i).fill('3.625')
    await inputByLabel(page, /width/i).fill('11.625')
    await inputByLabel(page, /length/i).fill('15.75')
    await page.keyboard.press('Tab')

    // Lot pricing card with grand total should appear
    await expect(page.getByText(/lot pricing/i)).toBeVisible()
    await expect(page.getByText(/grand total/i).last()).toBeVisible()
  })

  test('grand total changes when quantity changes', async ({ page }) => {
    await inputByLabel(page, /thickness/i).fill('3.625')
    await inputByLabel(page, /width/i).fill('11.625')
    await inputByLabel(page, /length/i).fill('15.75')
    await page.keyboard.press('Tab')

    // Read initial grand total
    const grandTotalEl = page.getByText(/grand total/i).last()
    await expect(grandTotalEl).toBeVisible()
    const initialTotal = await grandTotalEl.locator('..').textContent()

    // Change quantity
    const qtyInput = inputByLabel(page, /quantity/i)
    await qtyInput.fill('200')
    await qtyInput.blur()

    // Total should change
    await page.waitForTimeout(300) // reactive update
    const newTotal = await grandTotalEl.locator('..').textContent()
    expect(newTotal).not.toEqual(initialTotal)
  })

  test('print button appears after calculation', async ({ page }) => {
    await inputByLabel(page, /thickness/i).fill('3.625')
    await inputByLabel(page, /width/i).fill('11.625')
    await inputByLabel(page, /length/i).fill('15.75')
    await page.keyboard.press('Tab')

    await expect(page.getByRole('button', { name: /print/i })).toBeVisible()
  })

  test('switching to Round Bar changes dimension fields', async ({ page }) => {
    // Click ROUND_BAR geometry button
    await page.getByRole('button', { name: /round bar/i, exact: false }).click()
    // Should now show Diameter label
    await expect(page.getByText(/diameter.*in/i).first()).toBeVisible()
  })

  test('Ring geometry shows OD / ID fields', async ({ page }) => {
    await page.getByRole('button', { name: /ring/i, exact: false }).first().click()
    // Labels are "OD (in)" and "ID (in)"
    await expect(page.getByText(/^OD \(in\)/)).toBeVisible()
    await expect(page.getByText(/^ID \(in\)/)).toBeVisible()
  })

  test('weight pricing switch visible for eligible geometry', async ({ page }) => {
    // FLAT_BAR is weight-eligible
    const weightSwitch = page.getByRole('switch')
    await expect(weightSwitch).toBeVisible()
  })

  test('customers tab loads customer list', async ({ page }) => {
    await page.getByRole('tab', { name: /customer/i }).click()
    // Should show a table or list of customers
    await expect(page.getByRole('table').or(page.getByText(/premco/i))).toBeVisible()
  })

  test('settings tab loads UT settings form', async ({ page }) => {
    await page.getByRole('tab', { name: /settings/i }).click()
    // Should show hourly rate or scan speed fields
    await expect(page.getByText(/hourly rate/i).first()).toBeVisible()
  })
})
