import { test, expect } from '@playwright/test'
import { SidebarPage } from '../pages/SidebarPage'

test.describe('Navigation', () => {
  let sidebar: SidebarPage

  test.beforeEach(async ({ page }) => {
    sidebar = new SidebarPage(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('app loads and renders sidebar', async ({ page }) => {
    await expect(page).toHaveURL('/')
    // Sidebar nav links all present
    await expect(sidebar.navDashboard).toBeVisible()
    await expect(sidebar.navRT).toBeVisible()
    await expect(sidebar.navUT).toBeVisible()
    await expect(sidebar.navQuotes).toBeVisible()
    await expect(sidebar.navSettings).toBeVisible()
    await expect(sidebar.navAdmin).toBeVisible()
  })

  test('navigate to Dashboards', async ({ page }) => {
    await sidebar.clickDashboard()
    await expect(page).toHaveURL('/')
    // Navigate to Overview tab content (may need tab click if not default)
    const overviewTab = page.getByRole('tab', { name: /overview/i })
    if (await overviewTab.isVisible()) await overviewTab.click()
    await expect(page.getByText(/total quotes/i)).toBeVisible()
  })

  test('navigate to RT Costing', async ({ page }) => {
    await sidebar.clickRT()
    await expect(page).toHaveURL('/rt')
    await expect(page.getByText(/RT/i).first()).toBeVisible()
  })

  test('navigate to UT Calculator', async ({ page }) => {
    await sidebar.clickUT()
    await expect(page).toHaveURL('/ut')
    await expect(page.getByText(/calculator/i).first()).toBeVisible()
  })

  test('navigate to Quotes', async ({ page }) => {
    await sidebar.clickQuotes()
    // SPA client-side navigation — URL changes immediately
    await expect(page).toHaveURL('/quotes')
    // Content tested in 05-quotes.spec.ts
  })

  test('navigate to Settings', async ({ page }) => {
    await sidebar.clickSettings()
    await expect(page).toHaveURL('/settings')
    await expect(page.getByText(/salesforce/i).first()).toBeVisible()
  })

  test('dark mode toggle persists across reload', async ({ page }) => {
    // Start in light mode
    await page.evaluate(() => localStorage.setItem('theme', 'light'))
    await page.reload()

    // Toggle to dark — button has title "Dark mode" when in light mode
    const toggle = page.locator('button[title="Dark mode"]').or(page.locator('button[title="Light mode"]'))
    const htmlEl = page.locator('html')
    const classBefore = await htmlEl.getAttribute('class')

    await toggle.click()

    // Should have changed dark class state
    const classAfter = await htmlEl.getAttribute('class')
    expect(classBefore).not.toEqual(classAfter)

    // Persists on reload
    await page.reload()
    const classAfterReload = await htmlEl.getAttribute('class')
    expect(classAfterReload).toEqual(classAfter)
  })

  test('direct URL navigation works for all routes', async ({ page }) => {
    // Dashboard (Dashboards page — Overview tab)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const overviewTab = page.getByRole('tab', { name: /overview/i })
    if (await overviewTab.isVisible()) await overviewTab.click()
    await expect(page.getByText(/total quotes/i).first()).toBeVisible()

    // UT Calculator
    await page.goto('/ut')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('tab', { name: /calculator/i }).first()).toBeVisible()

    // RT Costing
    await page.goto('/rt')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('tab', { name: /quote/i }).first()).toBeVisible()

    // Quotes — URL check only; content tested in 05-quotes.spec.ts
    await page.goto('/quotes')
    await expect(page).toHaveURL('/quotes')

    // Settings
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/salesforce/i).first()).toBeVisible()

    // Admin
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible()
  })
})
