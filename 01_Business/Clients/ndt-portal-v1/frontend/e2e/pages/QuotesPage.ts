import { type Page, type Locator } from '@playwright/test'

export class QuotesPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly sourceFilter: Locator
  readonly statusFilter: Locator
  readonly quotesTable: Locator
  readonly detailDialog: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput  = page.getByPlaceholder(/customer/i)
    // Native <select> elements — Playwright uses locator('select') not getByRole('combobox')
    this.sourceFilter = page.locator('select').first()
    this.statusFilter = page.locator('select').nth(1)
    this.quotesTable  = page.getByRole('table')
    this.detailDialog = page.getByRole('dialog')
  }

  async goto() {
    await this.page.goto('/quotes')
    await this.page.waitForLoadState('networkidle')
  }

  /** Click the first row in the quotes table to open detail */
  async openFirstQuoteDetail() {
    const firstRow = this.page.getByRole('row').nth(1) // skip header
    await firstRow.click()
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }
}
