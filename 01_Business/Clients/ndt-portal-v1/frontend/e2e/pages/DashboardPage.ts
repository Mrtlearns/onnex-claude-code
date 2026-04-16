import { type Page, type Locator } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly kpiTotalQuotes: Locator
  readonly kpiPipelineValue: Locator
  readonly kpiAccepted: Locator
  readonly kpiAwaiting: Locator
  readonly recentQuotesTable: Locator
  readonly viewAllLink: Locator
  readonly quickActionCards: Locator
  readonly integrationPanel: Locator

  constructor(page: Page) {
    this.page = page
    this.kpiTotalQuotes    = page.getByText(/total quotes/i)
    this.kpiPipelineValue  = page.getByText(/pipeline value/i)
    this.kpiAccepted       = page.getByText(/accepted/i).first()
    this.kpiAwaiting       = page.getByText(/awaiting/i)
    this.recentQuotesTable = page.getByRole('table').first()
    this.viewAllLink       = page.getByRole('link', { name: /view all/i })
    this.quickActionCards  = page.locator('[class*="card"], [class*="Card"]')
    this.integrationPanel  = page.getByText(/salesforce|integration/i).first()
  }

  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }
}
