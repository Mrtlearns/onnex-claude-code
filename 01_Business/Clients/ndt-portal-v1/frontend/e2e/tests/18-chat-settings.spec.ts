/**
 * NDT Portal — Chat AI Settings E2E tests
 *
 * Covers:
 *  1. GET /settings/chat API contract
 *  2. POST /settings/chat — save chatProvider + chatModel
 *  3. Settings → LLM tab shows "Chat AI Settings" section
 *  4. Workshop page renders react-calendar-timeline (horizontal timeline)
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'

// ── Suite 1: GET /settings/chat API contract ───────────────────────────────

test.describe('GET /settings/chat — API contract', () => {

  test('returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/chat`)
    expect(res.status()).toBe(200)
  })

  test('response has chatProvider and chatModel fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/chat`)
    const body = await res.json()
    expect(body).toHaveProperty('chatProvider')
    expect(body).toHaveProperty('chatModel')
    expect(typeof body.chatProvider).toBe('string')
    expect(typeof body.chatModel).toBe('string')
  })

})

// ── Suite 2: POST /settings/chat — save ───────────────────────────────────

test.describe('POST /settings/chat — save chat settings', () => {

  test('returns 400 for unknown provider', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/settings/chat`, {
      data: { chatProvider: 'fakeai', chatModel: 'fake-model' },
    })
    expect(res.status()).toBe(400)
  })

  test('saves a valid provider + model', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/settings/chat`, {
      data: { chatProvider: 'anthropic', chatModel: 'claude-haiku-4-5-20251001' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.chatProvider).toBe('anthropic')
  })

  test('GET reflects saved values after POST', async ({ request }) => {
    await request.post(`${BASE}/api/ut/settings/chat`, {
      data: { chatProvider: 'anthropic', chatModel: 'claude-haiku-4-5-20251001' },
    })
    const res = await request.get(`${BASE}/api/ut/settings/chat`)
    const body = await res.json()
    expect(body.chatProvider).toBe('anthropic')
    expect(body.chatModel).toBe('claude-haiku-4-5-20251001')
  })

})

// ── Suite 3: Settings LLM tab — Chat AI Settings section ─────────────────

test.describe('Settings LLM tab — Chat AI Settings UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    // Click the LLM tab
    const llmTab = page.getByRole('tab', { name: 'LLM' })
    if (await llmTab.count() > 0) {
      await llmTab.first().click()
      await page.waitForTimeout(800)
    }
  })

  test('LLM tab loads without error', async ({ page }) => {
    // No error state
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('Chat AI Settings heading visible when a provider has a key', async ({ page }) => {
    // Only shown when at least one provider has a key saved
    const providersRes = await page.request.get(`${BASE}/api/ut/settings/providers`)
    const providersBody = await providersRes.json()
    const anyKeySet = providersBody.providers.some((p: { hasKey: boolean }) => p.hasKey)

    if (anyKeySet) {
      await expect(page.getByText('Chat AI Settings')).toBeVisible({ timeout: 5000 })
    } else {
      // Section only appears when at least one provider key is set — skip assertion
      test.skip()
    }
  })

  test('Save Chat Settings button exists on LLM tab', async ({ page }) => {
    // Check if any provider key is set
    const providersRes = await page.request.get(`${BASE}/api/ut/settings/providers`)
    const providersBody = await providersRes.json()
    const anyKeySet = providersBody.providers.some((p: { hasKey: boolean }) => p.hasKey)

    if (anyKeySet) {
      const btn = page.getByRole('button', { name: /save chat settings/i })
      await expect(btn).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })

})

// ── Suite 4: Workshop page — react-calendar-timeline ─────────────────────

test.describe('Workshop page — horizontal timeline', () => {

  test.beforeEach(async ({ page }) => {
    // Use domcontentloaded — workshop has persistent SSE that prevents networkidle
    await page.goto('/workshop', { waitUntil: 'domcontentloaded' })
    // Wait for the app root to mount
    await page.waitForSelector('#root > *', { timeout: 15_000 })
  })

  test('workshop page loads without JS error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/workshop', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root > *', { timeout: 15_000 })
    // Allow a moment for React to render
    await page.waitForTimeout(1000)
    const criticalErrors = errors.filter(e => !e.includes('favicon'))
    expect(criticalErrors).toHaveLength(0)
  })

  test('Workshop Dashboard heading is visible', async ({ page }) => {
    await expect(page.getByText('Workshop Dashboard')).toBeVisible({ timeout: 10_000 })
  })

  test('LIVE or Connecting indicator is visible', async ({ page }) => {
    const indicator = page.getByText(/LIVE|Connecting/i)
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 })
  })

  test('timeline container renders (react-calendar-timeline)', async ({ page }) => {
    // react-calendar-timeline always renders a .rct-header-root element
    const timeline = page.locator('.rct-header-root, .rct-calendar-header')
    await expect(timeline.first()).toBeVisible({ timeout: 15_000 })
  })

  test('day navigator buttons are visible', async ({ page }) => {
    // DayNavigator has < Prev and Next > buttons
    const prevBtn = page.getByRole('button', { name: /prev/i })
    const nextBtn = page.getByRole('button', { name: /next/i })
    await expect(prevBtn.first()).toBeVisible({ timeout: 10_000 })
    await expect(nextBtn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('date label shows current day name', async ({ page }) => {
    // DayNavigator renders: <span class="text-xs ...">Saturday, April 5</span>
    const dayLabel = page.locator('span').filter({
      hasText: /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i,
    }).first()
    await expect(dayLabel).toBeVisible({ timeout: 10_000 })
    const text = await dayLabel.textContent()
    expect(text).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i)
  })

  test('clicking Next day changes the date label', async ({ page }) => {
    // Wait for date label to appear
    const dayLabel = page.locator('span').filter({
      hasText: /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i,
    }).first()
    await expect(dayLabel).toBeVisible({ timeout: 10_000 })
    const daysBefore = await dayLabel.textContent()

    // Click the Next button (ChevronRight, title="Next day")
    await page.locator('button[title="Next day"]').click()
    await page.waitForTimeout(300)

    const daysAfter = await dayLabel.textContent()
    expect(daysAfter).not.toBe(daysBefore)
  })

  test('timeline sidebar labels are visible (inspection type lanes)', async ({ page }) => {
    // react-calendar-timeline sidebar has .rct-sidebar
    const sidebar = page.locator('.rct-sidebar')
    await expect(sidebar.first()).toBeVisible({ timeout: 15_000 })
  })

})
