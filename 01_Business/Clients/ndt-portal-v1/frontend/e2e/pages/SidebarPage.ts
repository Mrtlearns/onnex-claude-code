import { type Page, type Locator } from '@playwright/test'

export class SidebarPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly navDashboard: Locator
  readonly navRT: Locator
  readonly navUT: Locator
  readonly navQuotes: Locator
  readonly navSettings: Locator
  readonly navAdmin: Locator
  readonly darkModeToggle: Locator
  readonly pinButton: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.locator('nav, [class*="sidebar"], aside').first()
    // Nav links by href
    // Scope all nav links to the sidebar navigation to avoid matching topbar quick-access links
    const nav = page.getByRole('navigation')
    this.navDashboard = nav.locator('a[href="/"]') // label is "Dashboards"
    this.navRT        = nav.locator('a[href="/rt"]')
    this.navUT        = nav.locator('a[href="/ut"]')
    this.navQuotes    = nav.locator('a[href="/quotes"]')
    this.navSettings  = nav.locator('a[href="/settings"]')
    this.navAdmin     = nav.locator('a[href="/admin"]')
    // Dark mode — button containing sun/moon SVG
    this.darkModeToggle = page.getByRole('button', { name: /dark|light|theme|moon|sun/i }).first()
    // Pin button (aria-label or title)
    this.pinButton = page.getByRole('button', { name: /pin/i })
  }

  async navigateTo(path: string) {
    await this.page.goto(path)
  }

  async clickDashboard() { await this.navDashboard.click() }
  async clickRT()        { await this.navRT.click() }
  async clickUT()        { await this.navUT.click() }
  async clickQuotes()    { await this.navQuotes.click() }
  async clickSettings()  { await this.navSettings.click() }
  async clickAdmin()     { await this.navAdmin.click() }
}
