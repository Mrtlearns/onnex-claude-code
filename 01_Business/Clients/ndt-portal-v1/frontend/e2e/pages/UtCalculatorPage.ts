import { type Page, type Locator } from '@playwright/test'

export class UtCalculatorPage {
  readonly page: Page
  readonly calculatorTab: Locator
  readonly customersTab: Locator
  readonly settingsTab: Locator
  readonly customerSelect: Locator
  readonly scanMetricsCard: Locator
  readonly lotPricingCard: Locator
  readonly grandTotalRow: Locator
  readonly printButton: Locator
  readonly weightPricingSwitch: Locator

  constructor(page: Page) {
    this.page = page
    this.calculatorTab    = page.getByRole('tab', { name: /calculator/i })
    this.customersTab     = page.getByRole('tab', { name: /customer/i })
    this.settingsTab      = page.getByRole('tab', { name: /settings/i })
    this.customerSelect   = page.getByRole('combobox').first()
    this.scanMetricsCard  = page.getByText(/scan metrics/i)
    this.lotPricingCard   = page.getByText(/lot pricing/i)
    this.grandTotalRow    = page.getByText(/grand total/i).last()
    this.printButton      = page.getByRole('button', { name: /print/i })
    this.weightPricingSwitch = page.getByRole('switch')
  }

  async goto() {
    await this.page.goto('/ut')
    await this.page.waitForLoadState('networkidle')
  }

  /** Click a geometry button by label text */
  async selectGeometry(label: string) {
    await this.page.getByRole('button', { name: label, exact: false }).first().click()
  }

  /** Fill a dimension field by its label */
  async fillDimension(label: string, value: string) {
    const input = this.page.getByLabel(label, { exact: false })
    await input.fill(value)
    await input.blur()
  }

  /** Fill quantity input */
  async fillQuantity(value: string) {
    const input = this.page.getByLabel(/quantity/i)
    await input.fill(value)
    await input.blur()
  }
}
