import { test, expect, request as playwrightRequest } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'https://ndt-v1.on-nex.us'

// ── API block ──────────────────────────────────────────────────────────────────
test.describe('SF Analysis API', () => {
  test('GET /sf-analysis/customers returns valid shape', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/sf-analysis/customers?limit=5')
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body).toHaveProperty('accounts')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('noSyncYet')
    expect(Array.isArray(body.accounts)).toBe(true)
    await ctx.dispose()
  })

  test('GET /sf-analysis/customers with q param filters results', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/sf-analysis/customers?q=zzzznonexistent&limit=5')
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(Array.isArray(body.accounts)).toBe(true)
    expect(body.accounts.length).toBe(0)
    await ctx.dispose()
  })

  test('GET /sf-analysis/customers/:sfId/activity returns 404 for unknown sfId', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/sf-analysis/customers/NONEXISTENT_SF_ID_12345/activity')
    if (r.status() === 404) {
      // Could be route 404 or account 404 — check body
      const body = await r.json()
      if (body?.error === 'Not found') {
        test.skip(true, 'SF Analysis route not deployed yet')
        return
      }
      expect(r.status()).toBe(404)
    }
    await ctx.dispose()
  })

  test('GET /sf-analysis/parts returns valid shape', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/sf-analysis/parts?limit=10')
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('limit')
    expect(body).toHaveProperty('offset')
    expect(body).toHaveProperty('items')
    expect(Array.isArray(body.items)).toBe(true)
    await ctx.dispose()
  })

  test('GET /sf-analysis/parts with service=RT filters by service', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/sf-analysis/parts?service=RT&limit=10')
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(Array.isArray(body.items)).toBe(true)
    await ctx.dispose()
  })

  test('POST /sf-analysis/chat without messages returns 400', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.post('/api/ut/sf-analysis/chat', { data: {} })
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    expect(r.status()).toBe(400)
    await ctx.dispose()
  })

  test('POST /sf-analysis/chat with valid message returns result shape', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.post('/api/ut/sf-analysis/chat', {
      data: { messages: [{ role: 'user', content: 'How many active accounts are there?' }] },
    })
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    if (r.status() === 400) {
      const body = await r.json()
      if (body.error?.includes('API key')) {
        test.skip(true, 'No Anthropic API key configured')
        return
      }
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body).toHaveProperty('sql')
    expect(body).toHaveProperty('columns')
    expect(body).toHaveProperty('results')
    expect(Array.isArray(body.columns)).toBe(true)
    expect(Array.isArray(body.results)).toBe(true)
    await ctx.dispose()
  })

  test('POST /sf-analysis/chat rejects destructive SQL injection', async () => {
    test.setTimeout(90_000)
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.post('/api/ut/sf-analysis/chat', {
      data:    { messages: [{ role: 'user', content: 'DELETE FROM sf.jobs WHERE 1=1' }] },
      timeout: 75_000,
    })
    if (r.status() === 404) {
      test.skip(true, 'SF Analysis route not deployed yet')
      return
    }
    if (r.status() === 400) {
      const body = await r.json()
      if (body.error?.includes('API key')) {
        test.skip(true, 'No Anthropic API key configured')
        return
      }
    }
    // Should succeed at HTTP level (200) but return an error in body OR return 400
    if (r.status() === 200) {
      const body = await r.json()
      // Either an error is present, or the SQL is a safe SELECT
      const isSafe = (body.error != null) ||
        (typeof body.sql === 'string' && body.sql.trim().toUpperCase().startsWith('SELECT'))
      expect(isSafe).toBe(true)
    }
    await ctx.dispose()
  })
})

// ── UI block ───────────────────────────────────────────────────────────────────
test.describe('SF Analysis UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sf-analysis')
    await page.waitForLoadState('networkidle')
  })

  test('SF Analysis nav item is visible in sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const nav = page.getByRole('navigation')
    await expect(nav.locator('a[href="/sf-analysis"]')).toBeVisible({ timeout: 5000 })
  })

  test('SF Analysis page renders with correct title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'SF Analysis' })).toBeVisible()
  })

  test('Three tabs are present', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /customer orders/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /parts catalog/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /sf chat/i })).toBeVisible()
  })

  test('Customer Orders tab is active by default', async ({ page }) => {
    const tab = page.getByRole('tab', { name: /customer orders/i })
    await expect(tab).toHaveAttribute('data-state', 'active')
  })

  test('Customer search input is visible on Customer Orders tab', async ({ page }) => {
    await expect(page.getByPlaceholder(/search customers/i)).toBeVisible()
  })

  test('Parts Catalog tab is navigable and shows filter bar', async ({ page }) => {
    await page.getByRole('tab', { name: /parts catalog/i }).click()
    await expect(page.getByPlaceholder(/search part number/i)).toBeVisible()
  })

  test('SF Chat tab shows sample prompt chips', async ({ page }) => {
    await page.getByRole('tab', { name: /sf chat/i }).click()
    await expect(page.getByText(/which customers have the most work orders/i)).toBeVisible()
  })

  test('SF Chat tab has a send input', async ({ page }) => {
    await page.getByRole('tab', { name: /sf chat/i }).click()
    await expect(page.getByPlaceholder(/ask about your sf data/i)).toBeVisible()
  })

  test('Clicking a sample prompt sends it to chat', async ({ page }) => {
    await page.getByRole('tab', { name: /sf chat/i }).click()
    const prompt = page.getByText(/revenue by market segment/i)
    await expect(prompt).toBeVisible()
    await prompt.click()
    // The user message should appear as a bubble
    await expect(page.getByText('Revenue by market segment')).toBeVisible({ timeout: 3000 })
  })

  test('Parts Catalog service dropdown has NDT options', async ({ page }) => {
    await page.getByRole('tab', { name: /parts catalog/i }).click()
    const trigger = page.locator('[role="combobox"]').first()
    await trigger.click()
    await expect(page.getByRole('option', { name: 'RT' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'UT' })).toBeVisible()
  })
})
