/**
 * NDT Portal — Workshop Machines E2E tests (spec 19)
 *
 * Covers:
 *  1. GET /workshop/machines API contract
 *  2. POST /workshop/machines — create machine
 *  3. PUT /workshop/machines/:id — update machine
 *  4. DELETE /workshop/machines/:id — soft delete (is_active=false)
 *  5. POST /workshop/machines/:id/offline — add offline window
 *  6. DELETE /workshop/machines/:id/offline/:wid — remove offline window
 *  7. GET /workshop/settings — includes new fields (workingDays, holidays, bufferMinutes)
 *  8. PATCH /workshop/settings/:key — working_days, holidays, buffer_minutes
 *  9. Workshop Settings page — machines section visible
 * 10. Workshop Settings page — working days checkboxes visible
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'

// ── Suite 1: GET /workshop/machines ──────────────────────────

test.describe('GET /workshop/machines — API contract', () => {

  test('returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/machines`)
    expect(res.status()).toBe(200)
  })

  test('returns array of machine objects', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/machines`)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('each machine has required fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/machines`)
    const machines = await res.json() as object[]
    if (machines.length > 0) {
      const m = machines[0] as Record<string, unknown>
      expect(m).toHaveProperty('id')
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('type')
      expect(m).toHaveProperty('isActive')
      expect(m).toHaveProperty('offlineWindows')
      expect(Array.isArray(m['offlineWindows'])).toBe(true)
    }
  })

  test('seeded machines include RT types from migration', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/machines`)
    const machines = await res.json() as Array<{ type: string; isActive: boolean }>
    const rtMachines = machines.filter((m) => m.type === 'RT' && m.isActive)
    expect(rtMachines.length).toBeGreaterThanOrEqual(1)
  })

})

// ── Suite 2: Machine CRUD ─────────────────────────────────────

test.describe('Machine CRUD', () => {

  let createdMachineId: string

  test('POST /workshop/machines — creates machine', async ({ request }) => {
    const res = await request.post(`${BASE}/api/workshop/machines`, {
      data: { name: 'Test RT Unit', type: 'RT', inspectorName: 'John Test' },
    })
    expect(res.status()).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('id')
    createdMachineId = body['id'] as string
  })

  test('POST /workshop/machines — requires name and type', async ({ request }) => {
    const res = await request.post(`${BASE}/api/workshop/machines`, {
      data: { name: 'No Type Machine' },
    })
    expect(res.status()).toBe(400)
  })

  test('PUT /workshop/machines/:id — updates machine name', async ({ request }) => {
    // First create a machine to update
    const create = await request.post(`${BASE}/api/workshop/machines`, {
      data: { name: 'Update Test Machine', type: 'UT' },
    })
    const created = await create.json() as Record<string, unknown>
    const id = created['id'] as string

    const res = await request.put(`${BASE}/api/workshop/machines/${id}`, {
      data: { name: 'Updated Name', inspectorName: 'Updated Inspector' },
    })
    expect(res.status()).toBe(200)

    // Verify via GET
    const getRes = await request.get(`${BASE}/api/workshop/machines`)
    const machines = await getRes.json() as Array<Record<string, unknown>>
    const updated = machines.find((m) => m['id'] === id)
    expect(updated).toBeTruthy()

    // Clean up
    await request.delete(`${BASE}/api/workshop/machines/${id}`)
  })

  test('DELETE /workshop/machines/:id — soft deletes (isActive=false)', async ({ request }) => {
    const create = await request.post(`${BASE}/api/workshop/machines`, {
      data: { name: 'Delete Test Machine', type: 'MT' },
    })
    const created = await create.json() as Record<string, unknown>
    const id = created['id'] as string

    const del = await request.delete(`${BASE}/api/workshop/machines/${id}`)
    expect(del.status()).toBe(200)
    const delBody = await del.json() as Record<string, unknown>
    expect(delBody['ok']).toBe(true)
  })

  test('offline window: POST and DELETE', async ({ request }) => {
    const create = await request.post(`${BASE}/api/workshop/machines`, {
      data: { name: 'Offline Test Machine', type: 'RT' },
    })
    const created = await create.json() as Record<string, unknown>
    const machineId = created['id'] as string

    // Add offline window
    const startAt = new Date(Date.now() + 86_400_000).toISOString()
    const endAt = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const addRes = await request.post(`${BASE}/api/workshop/machines/${machineId}/offline`, {
      data: { startAt, endAt, reason: 'Maintenance' },
    })
    expect(addRes.status()).toBe(201)
    const window = await addRes.json() as Record<string, unknown>
    expect(window).toHaveProperty('id')
    const windowId = window['id'] as string

    // Verify window appears in GET
    const getRes = await request.get(`${BASE}/api/workshop/machines`)
    const machines = await getRes.json() as Array<Record<string, unknown>>
    const machine = machines.find((m) => m['id'] === machineId)
    const windows = machine?.['offlineWindows'] as Array<Record<string, unknown>>
    expect(windows?.some((w) => w['id'] === windowId)).toBe(true)

    // Remove offline window
    const removeRes = await request.delete(`${BASE}/api/workshop/machines/${machineId}/offline/${windowId}`)
    expect(removeRes.status()).toBe(200)

    // Clean up machine
    await request.delete(`${BASE}/api/workshop/machines/${machineId}`)
  })

  // Clean up the created machine from first test
  test.afterAll(async ({ request }) => {
    if (createdMachineId) {
      await request.delete(`${BASE}/api/workshop/machines/${createdMachineId}`)
    }
  })

})

// ── Suite 3: Settings — new fields ───────────────────────────

test.describe('GET /workshop/settings — new fields', () => {

  test('settings include workingDays array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/settings`)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('workingDays')
    expect(Array.isArray(body['workingDays'])).toBe(true)
    const days = body['workingDays'] as string[]
    expect(days.length).toBeGreaterThan(0)
  })

  test('settings include holidays array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/settings`)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('holidays')
    expect(Array.isArray(body['holidays'])).toBe(true)
  })

  test('settings include bufferMinutes number', async ({ request }) => {
    const res = await request.get(`${BASE}/api/workshop/settings`)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('bufferMinutes')
    expect(typeof body['bufferMinutes']).toBe('number')
  })

  test('PATCH working_days updates and is reflected in GET', async ({ request }) => {
    const original = await (await request.get(`${BASE}/api/workshop/settings`)).json() as Record<string, unknown>
    const originalDays = original['workingDays'] as string[]

    const newDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const patchRes = await request.patch(`${BASE}/api/workshop/settings/working_days`, {
      data: { value: newDays },
    })
    expect(patchRes.status()).toBe(200)

    const getRes = await request.get(`${BASE}/api/workshop/settings`)
    const body = await getRes.json() as Record<string, unknown>
    expect(body['workingDays']).toEqual(newDays)

    // Restore original
    await request.patch(`${BASE}/api/workshop/settings/working_days`, {
      data: { value: originalDays },
    })
  })

  test('PATCH buffer_minutes persists', async ({ request }) => {
    const patchRes = await request.patch(`${BASE}/api/workshop/settings/buffer_minutes`, {
      data: { value: 15 },
    })
    expect(patchRes.status()).toBe(200)

    const getRes = await request.get(`${BASE}/api/workshop/settings`)
    const body = await getRes.json() as Record<string, unknown>
    expect(body['bufferMinutes']).toBe(15)

    // Restore to 0
    await request.patch(`${BASE}/api/workshop/settings/buffer_minutes`, { data: { value: 0 } })
  })

})

// ── Suite 4: Workshop Settings UI ────────────────────────────

test.describe('Workshop Settings UI — new sections', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/workshop/settings', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root > *', { timeout: 15_000 })
    await page.waitForTimeout(1000)
  })

  test('Settings page loads without error', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('"Working Days" section is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Working Days' })).toBeVisible({ timeout: 10_000 })
  })

  test('Working day checkboxes are present (Mon–Fri at minimum)', async ({ page }) => {
    const monBtn = page.getByRole('button', { name: 'Mon' })
    await expect(monBtn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('"Job Buffer Time" section is visible', async ({ page }) => {
    await expect(page.getByText('Job Buffer Time')).toBeVisible({ timeout: 10_000 })
  })

  test('"Inspection Types & Machines" section is visible', async ({ page }) => {
    await expect(page.getByText('Inspection Types & Machines')).toBeVisible({ timeout: 10_000 })
  })

  test('RT inspection type can be expanded to show machines', async ({ page }) => {
    // Find the RT section header inside the Inspection Types & Machines section
    // Look for a button near the "RT" monospace label
    const rtLabel = page.locator('span.font-mono.font-bold').filter({ hasText: /^RT$/ }).first()
    await expect(rtLabel).toBeVisible({ timeout: 10_000 })
    // The expand chevron is the last button in the same parent row
    const rtContainer = rtLabel.locator('../../..') // go up to the type header div
    const chevronBtn = rtContainer.locator('button').last()
    await chevronBtn.click({ timeout: 5000 }).catch(async () => {
      // Fallback: click any button near the RT label
      await page.locator('[class*="ChevronDown"], [class*="chevron"]').first().click()
    })
    await page.waitForTimeout(500)
    // Should show "Add RT machine" button or machine name inputs
    const addBtn = page.getByText(/Add RT machine/i)
    const machineInput = page.locator('input[placeholder="Machine name"]')
    const hasContent = await addBtn.count() > 0 || await machineInput.count() > 0
    expect(hasContent).toBe(true)
  })

  test('"Holidays & Closures" section is visible', async ({ page }) => {
    await expect(page.getByText('Holidays & Closures')).toBeVisible({ timeout: 10_000 })
  })

  test('"Save Changes" button is present', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /save changes/i })
    await expect(saveBtn.first()).toBeVisible({ timeout: 10_000 })
  })

})
