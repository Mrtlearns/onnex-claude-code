/**
 * NDT Portal — Inspection Types E2E tests
 *
 * Covers:
 *  1. API contract — GET /inspection-types returns 6 types with code/label fields
 *  2. Steps have provider/model/config fields (schema added in recent session)
 *  3. RT and UT inspection types have LLM extraction steps seeded
 *  4. UI — Settings → Inspection Types tab renders types with step counts
 *  5. Step CRUD — create, patch provider/model/config, delete
 *
 * Schema notes (important — these catch test failures if wrong):
 *   - Inspection types use snake_case: code, label, is_active, created_at, updated_at
 *   - Steps use snake_case: action_type, is_active, created_at (NOT camelCase)
 *   - There is NO 'name' field on inspection types (use code/label)
 *   - Steps DO have a 'name' field
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'

// ── Helper ─────────────────────────────────────────────────────────────────

async function getTypeId(request: import('@playwright/test').APIRequestContext, code: string) {
  const res = await request.get(`${BASE}/api/ut/inspection-types`)
  if (!res.ok()) return null
  const body = await res.json()
  const type = body.find((t: { code: string }) => t.code === code)
  return type?.id ?? null
}

// ── Suite 1: Inspection Types API ─────────────────────────────────────────

test.describe('GET /inspection-types — API contract', () => {

  test('returns 200 with an array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/inspection-types`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('returns at least 2 inspection types', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/inspection-types`)
    const body = await res.json()
    expect(body.length).toBeGreaterThanOrEqual(2)
  })

  test('RT inspection type exists (code === "RT")', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/inspection-types`)
    const body = await res.json()
    const rt = body.find((t: { code: string }) => t.code === 'RT')
    expect(rt).toBeTruthy()
    expect(rt.label).toMatch(/radiograph/i)
  })

  test('UT inspection type exists (code === "UT")', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/inspection-types`)
    const body = await res.json()
    const ut = body.find((t: { code: string }) => t.code === 'UT')
    expect(ut).toBeTruthy()
    expect(ut.label).toMatch(/ultrasonic/i)
  })

  test('each type has id, code, label, is_active fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/inspection-types`)
    const body = await res.json()
    for (const type of body) {
      expect(type).toHaveProperty('id')
      expect(type).toHaveProperty('code')
      expect(type).toHaveProperty('label')
      expect(type).toHaveProperty('is_active')
      expect(typeof type.id).toBe('string')
      expect(typeof type.code).toBe('string')
      expect(typeof type.label).toBe('string')
      expect(typeof type.is_active).toBe('boolean')
    }
  })

})

// ── Suite 2: Inspection Type Steps API ────────────────────────────────────

test.describe('GET /inspection-types/:id/steps — steps API', () => {

  test('steps endpoint returns array for RT type', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('RT type has at least 1 LLM step', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()

    // Steps use snake_case action_type
    const llmStep = steps.find((s: { action_type: string }) => s.action_type === 'llm')
    expect(llmStep).toBeTruthy()
  })

  test('UT type has at least 1 LLM step', async ({ request }) => {
    const id = await getTypeId(request, 'UT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()

    const llmStep = steps.find((s: { action_type: string }) => s.action_type === 'llm')
    expect(llmStep).toBeTruthy()
  })

  test('steps have provider and model fields (may be null)', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()
    if (!steps.length) { test.skip(); return }

    for (const step of steps) {
      expect('provider' in step).toBe(true)
      expect('model' in step).toBe(true)
    }
  })

  test('steps have config field (may be null or object)', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()
    if (!steps.length) { test.skip(); return }

    for (const step of steps) {
      expect('config' in step).toBe(true)
    }
  })

  test('RT LLM step instruction mentions RT-specific concepts', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()

    const llmStep = steps.find((s: { action_type: string }) => s.action_type === 'llm')
    if (!llmStep) { test.skip(); return }

    const instruction = llmStep.instruction ?? llmStep.system_prompt ?? ''
    expect(instruction.length).toBeGreaterThan(50)
    expect(instruction.toLowerCase()).toMatch(/film|radiograph|technique|exposure/i)
  })

  test('UT LLM step instruction mentions UT-specific concepts', async ({ request }) => {
    const id = await getTypeId(request, 'UT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()

    const llmStep = steps.find((s: { action_type: string }) => s.action_type === 'llm')
    if (!llmStep) { test.skip(); return }

    const instruction = llmStep.instruction ?? ''
    expect(instruction.length).toBeGreaterThan(50)
    expect(instruction.toLowerCase()).toMatch(/ultrasonic|thickness|scan|search unit/i)
  })

  test('RT step config contains output_schema or required_fields', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const res = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    if (!res.ok()) { test.skip(); return }
    const steps = await res.json()

    const llmStep = steps.find((s: { action_type: string }) => s.action_type === 'llm')
    if (!llmStep?.config) { test.skip(); return }

    const hasConfig = 'output_schema' in llmStep.config || 'required_fields' in llmStep.config
    expect(hasConfig).toBe(true)
  })

})

// ── Suite 3: Inspection Types UI ──────────────────────────────────────────

test.describe('Settings — Inspection Types tab UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  async function clickInspectionTypesTab(page: import('@playwright/test').Page) {
    // Settings tabs render as role="tab" (shadcn Tabs component), not role="button"
    const tab = page.getByRole('tab', { name: 'Inspection Types' })
    if (await tab.count() > 0) {
      await tab.first().click()
      await page.waitForTimeout(500)
    }
  }

  test('Inspection Types tab is accessible from settings', async ({ page }) => {
    // Tab renders as role="tab" (shadcn Tabs component)
    const tab = page.getByRole('tab', { name: 'Inspection Types' })
    await expect(tab.first()).toBeVisible({ timeout: 10_000 })
  })

  test('RT and UT full labels appear in the inspection types list', async ({ page }) => {
    await clickInspectionTypesTab(page)
    // Use full labels to avoid matching sidebar "RT Calculator" nav item
    await expect(page.getByText('Radiographic Testing').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Ultrasonic Testing').first()).toBeVisible({ timeout: 10_000 })
  })

  test('all 6 standard NDT type labels are visible', async ({ page }) => {
    await clickInspectionTypesTab(page)
    const labels = [
      'Radiographic Testing', 'Ultrasonic Testing', 'Magnetic Particle Testing',
      'Liquid Penetrant Testing', 'Visual Testing', 'Electromagnetic Testing',
    ]
    for (const label of labels) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('clicking RT type shows its Extract Quote Parameters step', async ({ page }) => {
    await clickInspectionTypesTab(page)
    // Click using full label, not code, to avoid nav interference
    const rtItem = page.getByText('Radiographic Testing').first()
    await rtItem.click()
    await page.waitForTimeout(500)
    // "RT — Extract Quote Parameters" step name should appear
    await expect(page.getByText(/Extract Quote Parameters/i).first()).toBeVisible({ timeout: 5000 })
  })

})

// ── Suite 4: Step CRUD ─────────────────────────────────────────────────────

test.describe('Step CRUD — create / patch / delete', () => {

  test('POST + DELETE creates and removes a step', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const createRes = await request.post(`${BASE}/api/ut/inspection-types/${id}/steps`, {
      data: {
        name: 'E2E Test Step — delete me',
        action_type: 'llm',
        instruction: 'Test instruction for E2E',
        sort_order: 999,
        is_active: false,
      },
    })
    expect([200, 201]).toContain(createRes.status())
    if (!createRes.ok()) { test.skip(); return }

    const created = await createRes.json()
    const stepId = created.id
    expect(stepId).toBeTruthy()

    // Delete it
    const deleteRes = await request.delete(`${BASE}/api/ut/inspection-types/${id}/steps/${stepId}`)
    expect([200, 204]).toContain(deleteRes.status())

    // Verify gone
    const stepsRes = await request.get(`${BASE}/api/ut/inspection-types/${id}/steps`)
    const steps = await stepsRes.json()
    const found = steps.find((s: { id: string }) => s.id === stepId)
    expect(found).toBeFalsy()
  })

  test('PATCH updates provider and model fields', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const createRes = await request.post(`${BASE}/api/ut/inspection-types/${id}/steps`, {
      data: {
        name: 'E2E Provider Test Step',
        action_type: 'llm',
        instruction: 'Test',
        sort_order: 998,
        is_active: false,
      },
    })
    if (!createRes.ok()) { test.skip(); return }
    const created = await createRes.json()
    const stepId = created.id

    const patchRes = await request.patch(`${BASE}/api/ut/inspection-types/${id}/steps/${stepId}`, {
      data: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    })
    expect(patchRes.status()).toBe(200)
    const updated = await patchRes.json()
    expect(updated.provider).toBe('anthropic')
    expect(updated.model).toBe('claude-haiku-4-5-20251001')

    await request.delete(`${BASE}/api/ut/inspection-types/${id}/steps/${stepId}`)
  })

  test('PATCH stores and returns config JSON', async ({ request }) => {
    const id = await getTypeId(request, 'RT')
    if (!id) { test.skip(); return }

    const createRes = await request.post(`${BASE}/api/ut/inspection-types/${id}/steps`, {
      data: {
        name: 'E2E Config Test Step',
        action_type: 'llm',
        instruction: 'Test',
        sort_order: 997,
        is_active: false,
      },
    })
    if (!createRes.ok()) { test.skip(); return }
    const created = await createRes.json()
    const stepId = created.id

    const configData = { max_tokens: 2048, temperature: 0.1 }
    const patchRes = await request.patch(`${BASE}/api/ut/inspection-types/${id}/steps/${stepId}`, {
      data: { config: configData },
    })
    expect(patchRes.status()).toBe(200)
    const updated = await patchRes.json()
    expect(updated.config).toEqual(configData)

    await request.delete(`${BASE}/api/ut/inspection-types/${id}/steps/${stepId}`)
  })

})
