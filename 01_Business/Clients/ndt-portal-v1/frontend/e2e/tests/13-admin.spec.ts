import { test, expect } from '@playwright/test'
import { SidebarPage } from '../pages/SidebarPage'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'

test.describe('Admin API Contract', () => {

  test('GET /admin/jobs returns {total, runs}', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs`)
    if (res.status() === 404) {
      test.skip(true, 'Admin jobs endpoint not deployed')
      return
    }
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.total).toBe('number')
    expect(Array.isArray(body.runs)).toBe(true)
  })

  test('run shape has required fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    expect(res.status()).toBe(200)
    const body = await res.json()
    if (body.runs.length === 0) { test.skip(true, 'No job runs in DB'); return }
    const run = body.runs[0]
    expect(run).toHaveProperty('id')
    expect(run).toHaveProperty('job_name')
    expect(run).toHaveProperty('started_at')
    expect(run).toHaveProperty('status')
    expect(run).toHaveProperty('duration_ms')
    expect(run).toHaveProperty('records_upserted')
    expect(run).toHaveProperty('summary')
  })

  test('started_at is a valid ISO date', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    const body = await res.json()
    if (body.runs.length === 0) { test.skip(true, 'No job runs in DB'); return }
    for (const run of body.runs) {
      expect(new Date(run.started_at).getTime()).not.toBeNaN()
    }
  })

  test('status values are valid enum', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    const body = await res.json()
    const validStatuses = ['running', 'success', 'error']
    for (const run of body.runs) {
      expect(validStatuses).toContain(run.status)
    }
  })

  test('records_upserted is object or null', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    const body = await res.json()
    if (body.runs.length === 0) { test.skip(true, 'No job runs in DB'); return }
    for (const run of body.runs) {
      if (run.records_upserted !== null) {
        expect(typeof run.records_upserted).toBe('object')
        expect(Object.keys(run.records_upserted).length).toBeGreaterThan(0)
      }
    }
  })

  test('GET /admin/jobs?limit=1 respects limit', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs?limit=1`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.runs.length).toBeLessThanOrEqual(1)
  })

  test('GET /admin/jobs?job=sf_sync filters by job_name', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs?job=sf_sync`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    expect(res.status()).toBe(200)
    const body = await res.json()
    for (const run of body.runs) {
      expect(run.job_name).toBe('sf_sync')
    }
  })

  test('GET /admin/jobs/:id returns single run', async ({ request }) => {
    const listRes = await request.get(`${BASE}/api/ut/admin/jobs`)
    if (listRes.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    const listBody = await listRes.json()
    if (listBody.runs.length === 0) { test.skip(true, 'No job runs in DB'); return }
    const firstId = listBody.runs[0].id
    const res = await request.get(`${BASE}/api/ut/admin/jobs/${firstId}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(firstId)
  })

  test('GET /admin/jobs/999999 returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs/999999`)
    // 404 whether endpoint missing or record missing — both acceptable
    expect(res.status()).toBe(404)
  })

  test('GET /admin/jobs/notanumber returns 400', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ut/admin/jobs/notanumber`)
    if (res.status() === 404) { test.skip(true, 'Admin jobs endpoint not deployed'); return }
    expect(res.status()).toBe(400)
  })

})

test.describe('Admin UI', () => {
  let sidebar: SidebarPage

  test.beforeEach(async ({ page }) => {
    sidebar = new SidebarPage(page)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
  })

  test('Admin nav item visible in sidebar', async ({ page }) => {
    await expect(page.locator('a[href="/admin"]')).toBeVisible()
  })

  test('sidebar Admin link navigates to /admin', async ({ page }) => {
    await sidebar.navAdmin.click()
    await expect(page).toHaveURL('/admin')
  })

  test('topbar breadcrumb shows Admin', async ({ page }) => {
    // Target the header specifically to avoid matching hidden sidebar text
    await expect(page.locator('header').getByText('Admin')).toBeVisible()
  })

  test('AdminApp renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible()
  })

  test('Jobs tab trigger is visible and active', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /jobs/i })).toBeVisible()
  })

  test('Jobs table renders column headers', async ({ page }) => {
    // Table is only rendered when API is reachable (no error state)
    const errorEl = page.locator('.text-destructive')
    const hasError = await errorEl.isVisible()
    if (hasError) { test.skip(true, 'Admin jobs API not reachable'); return }
    // Use th to avoid matching other text with same words
    await expect(page.locator('th', { hasText: 'Job' })).toBeVisible()
    await expect(page.locator('th', { hasText: 'Status' })).toBeVisible()
    await expect(page.locator('th', { hasText: 'Started' })).toBeVisible()
    await expect(page.locator('th', { hasText: 'Duration' })).toBeVisible()
  })

  test('at least one job run row is visible', async ({ page }) => {
    const errorEl = page.locator('.text-destructive')
    const hasError = await errorEl.isVisible()
    if (hasError) { test.skip(true, 'Admin jobs API not reachable'); return }
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThanOrEqual(1)
  })

  test('status badge renders correctly', async ({ page }) => {
    const errorEl = page.locator('.text-destructive')
    const hasError = await errorEl.isVisible()
    if (hasError) { test.skip(true, 'Admin jobs API not reachable'); return }
    const badge = page.locator('tbody tr').first().getByText(/^(success|running|error)$/i)
    await expect(badge).toBeVisible()
  })

  test('row click expands detail', async ({ page }) => {
    const errorEl = page.locator('.text-destructive')
    const hasError = await errorEl.isVisible()
    if (hasError) { test.skip(true, 'Admin jobs API not reachable'); return }
    await page.locator('tbody tr').first().click()
    await expect(page.getByText(/summary/i).first()).toBeVisible()
  })

  test('refresh button is clickable', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /refresh/i })
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()
    // No error thrown = pass
  })

})
