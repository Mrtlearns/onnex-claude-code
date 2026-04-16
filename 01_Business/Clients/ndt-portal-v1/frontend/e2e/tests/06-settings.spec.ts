import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/SettingsPage'

test.describe('Settings', () => {
  let settingsPage: SettingsPage

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page)
    // Clear localStorage integration settings before each test
    await page.goto('/settings')
    await page.evaluate(() => localStorage.removeItem('ndt_integration_settings'))
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('renders three integration tabs', async () => {
    await expect(settingsPage.salesforceTab).toBeVisible()
    await expect(settingsPage.emailTab).toBeVisible()
    await expect(settingsPage.n8nTab).toBeVisible()
  })

  test('Salesforce tab has credential input fields', async ({ page }) => {
    await settingsPage.salesforceTab.click()
    // Should have inputs for instanceUrl, clientId, clientSecret
    const inputs = page.getByRole('textbox')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('Email tab shows email provider fields', async ({ page }) => {
    await settingsPage.emailTab.click()
    const inputs = page.getByRole('textbox')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('n8n tab shows webhook configuration fields', async ({ page }) => {
    await settingsPage.n8nTab.click()
    const inputs = page.getByRole('textbox')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('save button present on Salesforce tab', async () => {
    await settingsPage.salesforceTab.click()
    await expect(settingsPage.saveButton).toBeVisible()
  })

  test('filling and saving Salesforce fields persists to localStorage', async ({ page }) => {
    await settingsPage.salesforceTab.click()

    const inputs = page.getByRole('textbox')
    const firstInput = inputs.first()
    await firstInput.fill('https://test.salesforce.com')

    await settingsPage.saveButton.click()

    // Saved badge / indicator should appear
    await expect(page.getByText(/saved/i)).toBeVisible()

    // localStorage should have the data
    const stored = await page.evaluate(() => localStorage.getItem('ndt_integration_settings'))
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    // Should have salesforce key
    expect(parsed).toHaveProperty('salesforce')
  })

  test('settings persist after page reload', async ({ page }) => {
    await settingsPage.salesforceTab.click()

    const inputs = page.getByRole('textbox')
    await inputs.first().fill('https://persist-test.salesforce.com')
    await settingsPage.saveButton.click()
    await expect(page.getByText(/saved/i)).toBeVisible()

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await settingsPage.salesforceTab.click()

    // Input should still have the value
    await expect(inputs.first()).toHaveValue('https://persist-test.salesforce.com')
  })

  test.afterEach(async ({ page }) => {
    // Clean up localStorage after settings tests
    await page.evaluate(() => localStorage.removeItem('ndt_integration_settings'))
  })
})
