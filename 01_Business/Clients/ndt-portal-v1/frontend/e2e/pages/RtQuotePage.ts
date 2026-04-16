import { type Page, type Locator } from '@playwright/test'

export class RtQuotePage {
  readonly page: Page
  readonly quoteTab: Locator
  readonly settingsTab: Locator
  readonly partNumberInput: Locator
  readonly customerNameInput: Locator
  readonly newQuoteButton: Locator
  readonly addViewButton: Locator
  readonly viewRowsTable: Locator
  readonly tierComparisonCard: Locator
  readonly printButton: Locator
  readonly emptyRowsMsg: Locator

  constructor(page: Page) {
    this.page = page
    this.quoteTab           = page.getByRole('tab', { name: /quote/i })
    this.settingsTab        = page.getByRole('tab', { name: /settings/i })
    this.partNumberInput    = page.getByPlaceholder(/part number/i)
    this.customerNameInput  = page.getByPlaceholder(/customer name/i)
    this.newQuoteButton     = page.getByRole('button', { name: /new quote/i })
    this.addViewButton      = page.getByRole('button', { name: /add view/i })
    this.viewRowsTable      = page.getByRole('table').first()
    this.tierComparisonCard = page.getByText(/pricing tier comparison/i)
    this.printButton        = page.getByRole('button', { name: /print/i })
    this.emptyRowsMsg       = page.getByText(/no view rows yet/i)
  }

  async goto() {
    await this.page.goto('/rt')
    await this.page.waitForLoadState('networkidle')
  }

  async createQuote(partNumber: string, customerName: string) {
    await this.partNumberInput.fill(partNumber)
    await this.customerNameInput.fill(customerName)
    await this.newQuoteButton.click()
  }
}
