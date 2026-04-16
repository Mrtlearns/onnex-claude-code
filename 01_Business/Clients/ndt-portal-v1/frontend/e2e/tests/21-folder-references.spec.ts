/**
 * NDT Portal — Folder References E2E tests (spec 21)
 *
 * Covers:
 *  1. GET /settings/folder-references — API contract
 *  2. POST /settings/folder-references — create with valid data
 *  3. POST /settings/folder-references — rejects invalid alias
 *  4. POST /settings/folder-references — rejects duplicate alias
 *  5. PUT /settings/folder-references/:id — update display name
 *  6. DELETE /settings/folder-references/:id — soft-delete
 *  7. UI: Folder Refs tab is visible in Settings
 *  8. UI: Add Reference button opens dialog
 *  9. UI: Form saves and row appears in table
 * 10. UI: Delete removes row from table
 */

import { test, expect } from '@playwright/test'
import { SettingsPage } from '../pages/SettingsPage'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'
const API  = `${BASE}/api/ut/settings/folder-references`

// ── Suite 1: API contract ─────────────────────────────────────

test.describe('GET /settings/folder-references — API contract', () => {

  test('returns 200', async ({ request }) => {
    const res = await request.get(API)
    expect(res.status()).toBe(200)
  })

  test('returns array', async ({ request }) => {
    const body = await (await request.get(API)).json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('each reference has required fields', async ({ request }) => {
    const refs = await (await request.get(API)).json() as object[]
    if (refs.length > 0) {
      const r = refs[0] as Record<string, unknown>
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('alias')
      expect(r).toHaveProperty('displayName')
      expect(r).toHaveProperty('nextcloudPath')
      expect(r).toHaveProperty('isActive')
    }
  })

})

// ── Suite 2: CRUD ─────────────────────────────────────────────

test.describe('Folder reference CRUD', () => {

  const testAlias = `e2e_test_${Date.now()}`
  let createdId: string

  test('POST — creates reference with valid data', async ({ request }) => {
    const res = await request.post(API, {
      data: {
        alias:         testAlias,
        displayName:   'E2E Test Folder',
        nextcloudPath: '/NDT/E2ETest/',
        description:   'Created by Playwright spec 21',
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('id')
    expect(body['alias']).toBe(testAlias)
    expect(body['displayName']).toBe('E2E Test Folder')
    expect(body['nextcloudPath']).toBe('/NDT/E2ETest/')
    createdId = body['id'] as string
  })

  test('POST — rejects alias with invalid chars', async ({ request }) => {
    const res = await request.post(API, {
      data: {
        alias:         'Invalid Alias!',
        displayName:   'Bad Alias Test',
        nextcloudPath: '/NDT/Bad/',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(body).toHaveProperty('error')
  })

  test('POST — rejects duplicate alias', async ({ request }) => {
    const res = await request.post(API, {
      data: {
        alias:         testAlias,
        displayName:   'Duplicate',
        nextcloudPath: '/NDT/Dup/',
      },
    })
    expect(res.status()).toBe(409)
  })

  test('POST — rejects missing required fields', async ({ request }) => {
    const res = await request.post(API, {
      data: { alias: 'partial_only' },
    })
    expect(res.status()).toBe(400)
  })

  test('PUT — updates display name', async ({ request }) => {
    const res = await request.put(`${API}/${createdId}`, {
      data: { displayName: 'Updated E2E Display Name' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body['displayName']).toBe('Updated E2E Display Name')
    expect(body['alias']).toBe(testAlias) // alias unchanged
  })

  test('PUT — returns 404 for unknown id', async ({ request }) => {
    const res = await request.put(`${API}/00000000-0000-0000-0000-000000000000`, {
      data: { displayName: 'Ghost' },
    })
    expect(res.status()).toBe(404)
  })

  test('GET — created reference appears in list', async ({ request }) => {
    const refs = await (await request.get(API)).json() as Array<Record<string, unknown>>
    const found = refs.find(r => r['id'] === createdId)
    expect(found).toBeTruthy()
    expect(found!['alias']).toBe(testAlias)
  })

  test('DELETE — soft-deletes reference', async ({ request }) => {
    const res = await request.delete(`${API}/${createdId}`)
    expect(res.status()).toBe(204)
  })

  test('GET — deleted reference no longer in active list', async ({ request }) => {
    const refs = await (await request.get(API)).json() as Array<Record<string, unknown>>
    const found = refs.find(r => r['id'] === createdId)
    expect(found).toBeUndefined()
  })

  test('DELETE — returns 404 for already-deleted reference', async ({ request }) => {
    const res = await request.delete(`${API}/${createdId}`)
    expect(res.status()).toBe(404)
  })

})

// ── Suite 3: Settings UI ──────────────────────────────────────

test.describe('Settings — Folder Refs tab UI', () => {

  let settingsPage: SettingsPage

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page)
    await settingsPage.goto()
    await page.waitForLoadState('networkidle')
  })

  test('"Folder Refs" tab is visible', async () => {
    await expect(settingsPage.folderRefsTab).toBeVisible({ timeout: 10_000 })
  })

  test('clicking Folder Refs tab shows "Add Reference" button', async ({ page }) => {
    await settingsPage.folderRefsTab.click()
    await expect(settingsPage.addFolderRefButton).toBeVisible({ timeout: 10_000 })
  })

  test('Add Reference dialog opens on button click', async ({ page }) => {
    await settingsPage.folderRefsTab.click()
    await settingsPage.addFolderRefButton.click()
    // Dialog should appear with Alias input
    await expect(page.getByPlaceholder('tech_spec')).toBeVisible({ timeout: 5_000 })
  })

  test('form saves and row appears in table', async ({ page }) => {
    const uniqueAlias = `ui_test_${Date.now()}`

    await settingsPage.folderRefsTab.click()
    await settingsPage.addFolderRefButton.click()

    // Fill form
    await page.getByPlaceholder('tech_spec').fill(uniqueAlias)
    await page.getByPlaceholder('Technical Specifications').fill('UI Test Folder')
    await page.getByPlaceholder('/NDT/TechSpecs/').fill('/NDT/UITest/')

    // Save
    await page.getByRole('button', { name: /^save$/i }).click()
    await page.waitForTimeout(1000)

    // Row should appear in table
    await expect(settingsPage.folderRefRow(uniqueAlias)).toBeVisible({ timeout: 8_000 })

    // Clean up via API
    const refs = await page.request.get(API).then(r => r.json()) as Array<Record<string, unknown>>
    const created = refs.find(r => r['alias'] === uniqueAlias)
    if (created?.['id']) {
      await page.request.delete(`${API}/${created['id'] as string}`)
    }
  })

  test('delete button removes row from table', async ({ page }) => {
    const uniqueAlias = `del_test_${Date.now()}`

    // Create via API first
    const createRes = await page.request.post(API, {
      data: { alias: uniqueAlias, displayName: 'Del UI Test', nextcloudPath: '/NDT/Del/' },
    })
    expect(createRes.status()).toBe(201)

    await settingsPage.folderRefsTab.click()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await settingsPage.folderRefsTab.click()
    await page.waitForTimeout(500)

    // Row should be visible
    const row = settingsPage.folderRefRow(uniqueAlias)
    await expect(row).toBeVisible({ timeout: 8_000 })

    // Register dialog handler BEFORE clicking (confirm fires synchronously)
    page.once('dialog', dialog => void dialog.accept())

    // Click delete button scoped to this row's <tr>
    const deleteBtn = row.locator('..').getByTitle('Remove')
    await deleteBtn.click()
    await page.waitForTimeout(1000)

    // Row should be gone
    await expect(settingsPage.folderRefRow(uniqueAlias)).not.toBeVisible({ timeout: 5_000 })
  })

})
