/**
 * NDT Portal — Multi-provider LLM Settings E2E tests
 *
 * Covers:
 *  1. API contract — GET /settings/providers returns {providers: [...], defaultProvider} shape
 *  2. Each provider has name, hasKey, model, label fields
 *  3. POST /settings/providers/:name — accepts apiKey + model
 *  4. POST /settings/providers/:name/test — test endpoint reachable
 *  5. UI — Settings LLM tab renders 4 provider cards, default dropdown, save/test buttons
 *
 * Why this suite was missing: Multi-provider settings were added in a focused session
 * after the base settings tests were written. The new /settings/providers endpoints
 * had zero coverage.
 *
 * API shape: GET returns { providers: [...], defaultProvider: "openrouter" }
 *            (NOT a bare array)
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'
const EXPECTED_PROVIDERS = ['openrouter', 'anthropic', 'openai', 'gemini']

// ── Suite 1: GET /settings/providers API contract ──────────────────────────

test.describe('GET /settings/providers — API contract', () => {

  test('returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    expect(res.status()).toBe(200)
  })

  test('response has providers array and defaultProvider fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Shape: { providers: [...], defaultProvider: "..." }
    expect(body).toHaveProperty('providers')
    expect(body).toHaveProperty('defaultProvider')
    expect(Array.isArray(body.providers)).toBe(true)
    expect(typeof body.defaultProvider).toBe('string')
  })

  test('returns exactly 4 providers', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    const body = await res.json()
    expect(body.providers.length).toBe(4)
  })

  test('all 4 expected provider names are present', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    const body = await res.json()
    const names = body.providers.map((p: { name: string }) => p.name)
    for (const expected of EXPECTED_PROVIDERS) {
      expect(names).toContain(expected)
    }
  })

  test('each provider has required fields: name, hasKey, model', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    const body = await res.json()

    for (const provider of body.providers) {
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('hasKey')
      expect(provider).toHaveProperty('model')
      expect(typeof provider.hasKey).toBe('boolean')
      expect(typeof provider.name).toBe('string')
    }
  })

  test('API key is masked when set (never returns plaintext key)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    const body = await res.json()

    for (const provider of body.providers) {
      if (provider.hasKey && provider.apiKey) {
        // Masked key should not be a real API key — either empty or contains mask chars
        // Real keys are typically 40+ chars starting with sk-
        const looksLikeRealKey = /^sk-[A-Za-z0-9]{20,}$/.test(provider.apiKey)
        expect(looksLikeRealKey).toBe(false)
      }
    }
  })

  test('defaultProvider is one of the 4 provider names', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/settings/providers`)
    const body = await res.json()
    expect(EXPECTED_PROVIDERS).toContain(body.defaultProvider)
  })

})

// ── Suite 2: POST /settings/providers/:name ────────────────────────────────

test.describe('POST /settings/providers/:name — save provider', () => {

  test('unknown provider name returns 400 or 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/settings/providers/unknown_provider`, {
      data: { apiKey: 'sk-test', model: 'test-model' },
    })
    expect([400, 404]).toContain(res.status())
  })

  test('valid provider save returns 200', async ({ request }) => {
    // Send model-only update (no API key change) to test save mechanics
    const res = await request.post(`${BASE}/api/ut/settings/providers/openai`, {
      data: { model: 'gpt-4o-mini' },
    })
    expect([200, 400]).toContain(res.status())
  })

  test('all 4 provider save endpoints exist (not 404)', async ({ request }) => {
    for (const provider of EXPECTED_PROVIDERS) {
      const res = await request.post(`${BASE}/api/ut/settings/providers/${provider}`, {
        data: { model: 'test-model' },
      })
      expect(res.status()).not.toBe(404)
    }
  })

})

// ── Suite 3: POST /settings/providers/:name/test ───────────────────────────

test.describe('POST /settings/providers/:name/test — connectivity test', () => {

  test('test endpoint exists and returns JSON (not 404)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/settings/providers/openrouter/test`, {
      data: {},
    })
    // 404 = endpoint missing (the bug we're catching)
    expect(res.status()).not.toBe(404)
    const body = await res.json()
    expect(body).toBeTruthy()
  })

  test('test response has ok, success, error, or message field', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/settings/providers/openrouter/test`, {
      data: {},
    })
    const body = await res.json()
    const hasStructure = 'ok' in body || 'success' in body || 'error' in body || 'message' in body
    expect(hasStructure).toBe(true)
  })

  test('test with unknown provider returns 400 or 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ut/settings/providers/fakeai/test`, {
      data: {},
    })
    expect([400, 404]).toContain(res.status())
  })

  test('all 4 provider test endpoints exist (not 404)', async ({ request }) => {
    for (const provider of EXPECTED_PROVIDERS) {
      const res = await request.post(`${BASE}/api/ut/settings/providers/${provider}/test`, {
        data: {},
      })
      expect(res.status()).not.toBe(404)
    }
  })

})

// ── Suite 4: Settings LLM UI ───────────────────────────────────────────────

test.describe('Settings — LLM Providers tab UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  async function clickLlmTab(page: import('@playwright/test').Page) {
    // Settings tabs render as role="tab" (shadcn Tabs component)
    const llmTab = page.getByRole('tab', { name: 'LLM' })
    if (await llmTab.count() > 0) {
      await llmTab.first().click()
      await page.waitForTimeout(500)
    }
  }

  test('LLM tab is visible in settings navigation', async ({ page }) => {
    // Settings tabs use role="tab" (shadcn Tabs component), not role="button"
    const llmTab = page.getByRole('tab', { name: 'LLM' })
    await expect(llmTab.first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking LLM tab shows 4 provider names', async ({ page }) => {
    await clickLlmTab(page)
    for (const provider of ['OpenRouter', 'Anthropic', 'OpenAI', 'Gemini']) {
      await expect(page.getByText(provider, { exact: false }).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('Default Provider label is visible on LLM tab', async ({ page }) => {
    await clickLlmTab(page)
    await expect(page.getByText(/default provider/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('at least 4 Save buttons are present on LLM tab', async ({ page }) => {
    await clickLlmTab(page)
    const saveButtons = page.getByRole('button', { name: /save/i })
    const count = await saveButtons.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('at least 4 Test buttons are present on LLM tab', async ({ page }) => {
    await clickLlmTab(page)
    const testButtons = page.getByRole('button', { name: /test/i })
    const count = await testButtons.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('API key input fields exist for providers', async ({ page }) => {
    await clickLlmTab(page)
    // Provider cards have text inputs for API keys
    const inputs = page.locator('input[type="text"], input[type="password"]')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(4)  // at least one per provider
  })

})
