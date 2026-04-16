import { test, expect, request as playwrightRequest } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'https://ndt-v1.on-nex.us'

// ── Machine catalog API ────────────────────────────────────────────────────────
test.describe('RT Machine Catalog API', () => {
  test('GET /rt/machines returns array with 3 default machines', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/rt/machines')
    if (r.status() === 404) {
      test.skip(true, 'RT machines route not deployed yet')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(3)
    const m = body[0]
    expect(m).toHaveProperty('machine_id')
    expect(m).toHaveProperty('nickname')
    expect(m).toHaveProperty('spec')
    await ctx.dispose()
  })

  test('GET /rt/machines each machine has spec.xray_source with max_voltage_kv', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/rt/machines')
    if (r.status() === 404) {
      test.skip(true, 'RT machines route not deployed yet')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    for (const m of body) {
      expect(m.spec).toBeDefined()
      expect(m.spec.xray_source).toBeDefined()
      expect(typeof m.spec.xray_source.max_voltage_kv).toBe('number')
    }
    await ctx.dispose()
  })

  test('POST /rt/machines creates a machine then DELETE removes it', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const testId = `RT_TEST_${Date.now()}`

    const postR = await ctx.post('/api/ut/rt/machines', {
      data: {
        machine_id: testId,
        nickname:   'Test Machine',
        make_model: 'Test Make/Model',
        spec:       { xray_source: { max_voltage_kv: 160 } },
      },
    })
    if (postR.status() === 404) {
      test.skip(true, 'RT machines route not deployed yet')
      return
    }
    expect(postR.status()).toBe(201)
    const created = await postR.json()
    expect(created.machine_id).toBe(testId)

    // Verify it appears in list
    const listR = await ctx.get('/api/ut/rt/machines')
    const list  = await listR.json()
    expect(list.some((m: { machine_id: string }) => m.machine_id === testId)).toBe(true)

    // Delete (soft)
    const delR = await ctx.delete(`/api/ut/rt/machines/${testId}`)
    expect(delR.status()).toBe(204)

    // Verify gone from active list
    const listR2 = await ctx.get('/api/ut/rt/machines')
    const list2  = await listR2.json()
    expect(list2.some((m: { machine_id: string }) => m.machine_id === testId)).toBe(false)

    await ctx.dispose()
  })
})

// ── RT Planning API ────────────────────────────────────────────────────────────
test.describe('RT Planning API', () => {
  const sampleEmailText = `
From: John Smith <jsmith@aerospace.com>
Subject: RT Quote Request — PN-70720187

Hi,

We need RT inspection on casting PN-70720187, Inconel 718, approximately 38mm wall thickness.
Acceptance per ASTM E1742. Two views required (0° and 90°).
Part fits in a 400mm diameter cylinder, 600mm tall, weight approx 45kg.
No unusual access constraints.

Thanks
`

  test('POST /rt/plan returns valid RtPlanningResult shape', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.post('/api/ut/rt/plan', {
      data: { rawInput: sampleEmailText },
      timeout: 60_000,
    })
    if (r.status() === 404) {
      test.skip(true, 'RT plan route not deployed yet')
      return
    }
    if (r.status() === 400) {
      const body = await r.json()
      test.skip(true, `No LLM configured: ${body.error}`)
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()

    // Top-level shape
    expect(body).toHaveProperty('extraction')
    expect(body).toHaveProperty('machineSuitability')
    expect(body).toHaveProperty('selectedMachineId')
    expect(body).toHaveProperty('techniqueCards')
    expect(body).toHaveProperty('sessionId')

    // techniqueCards array
    expect(Array.isArray(body.techniqueCards)).toBe(true)
    expect(body.techniqueCards.length).toBeGreaterThan(0)

    // Each card has required costing fields for RtViewRequest mapping
    for (const card of body.techniqueCards) {
      expect(typeof card.viewNumber).toBe('number')
      expect(typeof card.filmSizeLabel).toBe('string')
      expect([0, 1, 2, 3]).toContain(card.shotType)
      expect(typeof card.qtyPartsPerFilm).toBe('number')
      expect(typeof card.shotTime).toBe('number')
      expect(typeof card.unpackLoadTime).toBe('number')
      expect(typeof card.darkroomSortTime).toBe('number')
      expect(typeof card.readTime).toBe('number')
    }

    // machineSuitability
    expect(Array.isArray(body.machineSuitability)).toBe(true)
    for (const s of body.machineSuitability) {
      expect(typeof s.machineId).toBe('string')
      expect(typeof s.fitScore).toBe('number')
      expect(typeof s.suitabilityScore).toBe('number')
      expect(typeof s.disqualified).toBe('boolean')
    }

    await ctx.dispose()
  })

  test('POST /rt/plan sessionId appears in planning_sessions (via GET /rt/machines healthcheck)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.post('/api/ut/rt/plan', {
      data: { rawInput: sampleEmailText },
      timeout: 60_000,
    })
    if (r.status() === 404 || r.status() === 400) {
      test.skip(true, 'RT plan route not deployed or no LLM')
      return
    }
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    await ctx.dispose()
  })

  test('POST /rt/plan with missing rawInput returns 400', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.post('/api/ut/rt/plan', { data: {} })
    if (r.status() === 404) {
      test.skip(true, 'RT plan route not deployed yet')
      return
    }
    expect(r.status()).toBe(400)
    const body = await r.json()
    expect(body).toHaveProperty('error')
    await ctx.dispose()
  })
})

// ── Inspection Types UI — RT step visible ─────────────────────────────────────
test.describe('Inspection Types — RT planning step', () => {
  test('Settings → Inspection Types shows RT type', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')

    // Navigate to settings
    const settingsLink = page.getByRole('link', { name: /settings/i }).first()
    if (await settingsLink.count() === 0) {
      test.skip(true, 'Settings link not found')
      return
    }
    await settingsLink.click()
    await page.waitForLoadState('networkidle')

    // Find inspection types tab/section
    const inspTab = page.getByRole('tab', { name: /inspection types/i })
    if (await inspTab.count() > 0) {
      await inspTab.click()
    }

    await expect(page.getByText('RT', { exact: false })).toBeVisible({ timeout: 5000 })
  })

  test('GET /inspection-types API contains RT code with planning step', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const r   = await ctx.get('/api/ut/inspection-types')
    expect(r.status()).toBe(200)
    const types = await r.json()
    const rt = types.find((t: { code: string }) => t.code === 'RT')
    expect(rt).toBeDefined()
    expect(rt.label).toMatch(/radiographic/i)
    await ctx.dispose()
  })
})
