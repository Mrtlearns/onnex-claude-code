import { type Page, type Locator } from '@playwright/test'

export class SettingsPage {
  readonly page: Page
  readonly salesforceTab: Locator
  readonly emailTab: Locator
  readonly n8nTab: Locator
  readonly folderRefsTab: Locator
  readonly addFolderRefButton: Locator
  readonly saveButton: Locator
  readonly savedBadge: Locator

  constructor(page: Page) {
    this.page = page
    this.salesforceTab    = page.getByRole('tab', { name: /salesforce/i })
    this.emailTab         = page.getByRole('tab', { name: /email/i })
    this.n8nTab           = page.getByRole('tab', { name: /n8n/i })
    this.folderRefsTab    = page.getByRole('tab', { name: /folder refs/i })
    this.addFolderRefButton = page.getByRole('button', { name: /add reference/i })
    this.saveButton       = page.getByRole('button', { name: /save/i })
    this.savedBadge       = page.getByText(/saved/i)
  }

  folderRefRow(alias: string): Locator {
    return this.page.locator('td.font-mono').filter({ hasText: alias })
  }

  async goto() {
    await this.page.goto('/settings')
    await this.page.waitForLoadState('networkidle')
  }
}
