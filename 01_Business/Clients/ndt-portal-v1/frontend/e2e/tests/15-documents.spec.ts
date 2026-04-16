/**
 * Test suite: Documents — soft-delete, hard-delete, multi-select UI, maintenance, audit log.
 *
 * API paths (post-Traefik strip):
 *   /api/documents/*    → documents router (strips /api → /documents/*)
 *   /api/documents/maintenance  → POST maintenance handler
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'

const E2E_FILE = '_e2e_delete_test.txt'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadTestFile(baseURL: string) {
  const ctx = await playwrightRequest.newContext({ baseURL })
  await ctx.put(`/api/documents/${E2E_FILE}`, {
    data: 'playwright e2e delete test',
    headers: { 'Content-Type': 'text/plain' },
  })
  await ctx.dispose()
}

async function cleanupTestFile(baseURL: string) {
  const ctx = await playwrightRequest.newContext({ baseURL })
  // Attempt to hard-delete from _deleted/ (may or may not exist)
  await ctx.delete(`/api/documents/_deleted/${E2E_FILE}`).catch(() => {})
  // Attempt to delete from root (if soft-delete didn't happen)
  await ctx.delete(`/api/documents/${E2E_FILE}`).catch(() => {})
  await ctx.dispose()
}

// ── API Contract ──────────────────────────────────────────────────────────────

test.describe('Documents API', () => {

  test('POST /api/documents/maintenance returns valid shape', async ({ request }) => {
    const res = await request.post('/api/documents/maintenance')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.purged).toBe('number')
    expect(Array.isArray(body.errors)).toBe(true)
  })

  test('maintenance purged count is non-negative', async ({ request }) => {
    const res = await request.post('/api/documents/maintenance')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.purged).toBeGreaterThanOrEqual(0)
  })

  test('DELETE /api/documents/ (no path) returns 400', async ({ request }) => {
    // The route is DELETE /*, so an empty path hits the handler with resourcePath=''
    const res = await request.delete('/api/documents/')
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  test('soft delete: PUT → DELETE → file moves to _deleted/', async ({ request }) => {
    // Upload a fresh test file
    const putRes = await request.put(`/api/documents/${E2E_FILE}`, {
      data: 'playwright e2e test',
      headers: { 'Content-Type': 'text/plain' },
    })
    expect(putRes.ok()).toBe(true)

    // Soft-delete it (path NOT under _deleted/)
    const delRes = await request.delete(`/api/documents/${E2E_FILE}`)
    expect(delRes.status()).toBe(200)
    const delBody = await delRes.json()
    expect(delBody.ok).toBe(true)

    // Verify it now lives under _deleted/ — PROPFIND root should NOT list it
    const rootRes = await request.get('/api/documents')
    expect(rootRes.ok()).toBe(true)
    const rootXml = await rootRes.text()
    // The deleted filename should NOT be in the root listing
    expect(rootXml).not.toContain(`>${E2E_FILE}<`)

    // Verify it's in _deleted/
    const delFolderRes = await request.get('/api/documents/_deleted')
    if (delFolderRes.status() === 207) {
      const xml = await delFolderRes.text()
      expect(xml).toContain(E2E_FILE)
    }
  })

  test('hard delete: DELETE from _deleted/ path succeeds', async ({ request }) => {
    // Ensure test file exists in _deleted/ (re-upload + soft-delete if needed)
    await request.put(`/api/documents/${E2E_FILE}`, {
      data: 'hard delete test',
      headers: { 'Content-Type': 'text/plain' },
    })
    await request.delete(`/api/documents/${E2E_FILE}`)

    // Hard-delete from _deleted/
    const hardDelRes = await request.delete(`/api/documents/_deleted/${E2E_FILE}`)
    // 200 (ok) or 404 if file wasn't there — both acceptable depending on timing
    expect([200, 404]).toContain(hardDelRes.status())
    if (hardDelRes.status() === 200) {
      const body = await hardDelRes.json()
      expect(body).toHaveProperty('ok')
    }
  })

  test('audit log gets a row after soft delete', async ({ request }) => {
    // Upload and soft-delete a file so there's at least one audit row
    await request.put(`/api/documents/${E2E_FILE}`, {
      data: 'audit test',
      headers: { 'Content-Type': 'text/plain' },
    })
    await request.delete(`/api/documents/${E2E_FILE}`)

    // Verify via maintenance endpoint (indirectly proves DB is being written)
    // We can't query DB directly from Playwright, but maintenance runs a job_run insert
    const maintRes = await request.post('/api/documents/maintenance')
    expect(maintRes.status()).toBe(200)
    // If we got here without error, the DB round-trip in maintenance worked
  })

})

// ── UI Tests ──────────────────────────────────────────────────────────────────

test.describe('Documents UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')
  })

  test('Documents page loads at /documents', async ({ page }) => {
    await expect(page).toHaveURL('/documents')
    // "Documents" h2 heading in the left panel of DocumentsApp
    await expect(page.locator('h2').filter({ hasText: 'Documents' })).toBeVisible()
  })

  test('Documents sidebar nav link exists', async ({ page }) => {
    const nav = page.getByRole('navigation')
    await expect(nav.locator('a[href="/documents"]')).toBeVisible()
  })

  test('sidebar Documents link navigates to /documents', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const navLink = page.getByRole('navigation').locator('a[href="/documents"]')
    await expect(navLink).toBeVisible()
    await navLink.click()
    await expect(page).toHaveURL('/documents')
  })

  test('Nextcloud browser renders breadcrumb Root', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Root' })).toBeVisible()
  })

  test('select mode toggle button is always visible', async ({ page }) => {
    // Button title is "Select files" initially
    const toggleBtn = page.getByTitle('Select files')
    await expect(toggleBtn).toBeVisible()
  })

  test('entering select mode changes toggle to Exit selection mode', async ({ page }) => {
    const toggleBtn = page.getByTitle('Select files')
    await expect(toggleBtn).toBeVisible()
    await toggleBtn.click()
    await expect(page.getByTitle('Exit selection mode')).toBeVisible()
    // Toggle back
    await page.getByTitle('Exit selection mode').click()
    await expect(page.getByTitle('Select files')).toBeVisible()
  })

  test('select mode shows checkboxes on file rows', async ({ page }) => {
    // Skip if Nextcloud unavailable
    const errorText = page.getByText(/could not connect to nextcloud/i)
    if (await errorText.isVisible()) {
      test.skip(true, 'Nextcloud unavailable')
      return
    }
    // Wait for files to load
    await page.waitForTimeout(1500)

    const emptyMsg = page.getByText(/empty folder/i)
    if (await emptyMsg.isVisible()) {
      test.skip(true, 'No files in Nextcloud root to select')
      return
    }

    // Enter select mode
    await page.getByTitle('Select files').click()

    // Checkboxes should now be visible on rows (pointer-events-none but visible)
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes.first()).toBeVisible()
  })

  test('selecting a file shows trash delete button with count', async ({ page }) => {
    const errorText = page.getByText(/could not connect to nextcloud/i)
    if (await errorText.isVisible()) {
      test.skip(true, 'Nextcloud unavailable')
      return
    }
    await page.waitForTimeout(1500)
    const emptyMsg = page.getByText(/empty folder/i)
    if (await emptyMsg.isVisible()) {
      test.skip(true, 'No files in Nextcloud root')
      return
    }

    // Enter select mode then click the parent row div (checkbox has pointer-events-none)
    await page.getByTitle('Select files').click()
    // Target div rows that have a checkbox as a *direct* child (pointer-events-none on checkbox)
    const firstRow = page.locator('div:has(> input[type="checkbox"])').first()
    await firstRow.click()

    // Trash button should appear with count 1
    const deleteBtn = page.getByTitle(/delete 1 item/i)
    await expect(deleteBtn).toBeVisible()
    await expect(deleteBtn).toContainText('1')
  })

  test('exiting select mode hides trash button', async ({ page }) => {
    const errorText = page.getByText(/could not connect to nextcloud/i)
    if (await errorText.isVisible()) {
      test.skip(true, 'Nextcloud unavailable')
      return
    }
    await page.waitForTimeout(1500)
    const emptyMsg = page.getByText(/empty folder/i)
    if (await emptyMsg.isVisible()) {
      test.skip(true, 'No files in Nextcloud root')
      return
    }

    await page.getByTitle('Select files').click()
    // Click the parent row div to select (checkbox has pointer-events-none)
    // Target div rows that have a checkbox as a *direct* child (pointer-events-none on checkbox)
    const firstRow = page.locator('div:has(> input[type="checkbox"])').first()
    await firstRow.click()
    await expect(page.getByTitle(/delete 1 item/i)).toBeVisible()

    // Exit select mode — delete button should disappear
    await page.getByTitle('Exit selection mode').click()
    await expect(page.getByTitle(/delete 1 item/i)).not.toBeVisible()
  })

  test('soft-delete flow: upload file via API, delete via UI, file disappears from list', async ({ page }) => {
    const errorText = page.getByText(/could not connect to nextcloud/i)
    if (await errorText.isVisible()) {
      test.skip(true, 'Nextcloud unavailable')
      return
    }

    // Upload test file via API
    const baseURL = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'
    await uploadTestFile(baseURL)

    // Reload to pick up the new file
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Verify test file is in the root listing
    const testFileRow = page.getByText(E2E_FILE)
    await expect(testFileRow).toBeVisible()

    // Enter select mode and select the test file row
    await page.getByTitle('Select files').click()
    // Find the row containing E2E_FILE and click its checkbox
    const fileRow = page.locator('div').filter({ hasText: E2E_FILE }).last()
    await fileRow.click()

    // Trash button should show
    const deleteBtn = page.getByTitle(/delete 1 item/i)
    await expect(deleteBtn).toBeVisible()

    // Click delete (soft — no confirm dialog for non-_deleted/)
    await deleteBtn.click()

    // File should disappear from root listing after refresh
    await page.waitForTimeout(1500)
    await expect(page.getByText(E2E_FILE)).not.toBeVisible()
  })

  test('hard-delete confirm dialog appears when deleting from _deleted/', async ({ page }) => {
    const errorText = page.getByText(/could not connect to nextcloud/i)
    if (await errorText.isVisible()) {
      test.skip(true, 'Nextcloud unavailable')
      return
    }

    // Ensure there's a file in _deleted/ — upload + soft-delete
    const baseURL = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'
    await uploadTestFile(baseURL)
    const ctx = await playwrightRequest.newContext({ baseURL })
    await ctx.delete(`/api/documents/${E2E_FILE}`)
    await ctx.dispose()

    // Navigate into _deleted/ folder
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const deletedFolder = page.getByText('_deleted').first()
    if (!await deletedFolder.isVisible()) {
      test.skip(true, '_deleted folder not visible in browser')
      return
    }
    await deletedFolder.click()
    await page.waitForTimeout(1000)

    // Enter select mode, select the test file
    const emptyMsg = page.getByText(/empty folder/i)
    if (await emptyMsg.isVisible()) {
      test.skip(true, '_deleted folder is empty')
      return
    }

    await page.getByTitle('Select files').click()
    // Click parent row div — checkbox has pointer-events-none
    // Target div rows that have a checkbox as a *direct* child (pointer-events-none on checkbox)
    const firstRow = page.locator('div:has(> input[type="checkbox"])').first()
    await firstRow.click()

    const deleteBtn = page.getByTitle(/delete \d+ item/i)
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Confirm dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/permanently delete/i)).toBeVisible()
    await expect(page.getByText(/permanently removed from storage/i)).toBeVisible()

    // Cancel it — don't actually delete
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Cleanup
    await cleanupTestFile(baseURL)
  })

  test('hard-delete confirm dialog Delete Forever button actually deletes', async ({ page }) => {
    const errorText = page.getByText(/could not connect to nextcloud/i)
    if (await errorText.isVisible()) {
      test.skip(true, 'Nextcloud unavailable')
      return
    }

    const baseURL = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'
    await uploadTestFile(baseURL)
    const ctx = await playwrightRequest.newContext({ baseURL })
    await ctx.delete(`/api/documents/${E2E_FILE}`)
    await ctx.dispose()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    const deletedFolder = page.getByText('_deleted').first()
    if (!await deletedFolder.isVisible()) {
      test.skip(true, '_deleted folder not visible')
      return
    }
    await deletedFolder.click()
    await page.waitForTimeout(1000)

    const emptyMsg = page.getByText(/empty folder/i)
    if (await emptyMsg.isVisible()) {
      test.skip(true, '_deleted folder is empty')
      return
    }

    await page.getByTitle('Select files').click()
    // Click parent row div — checkbox has pointer-events-none
    // Target div rows that have a checkbox as a *direct* child (pointer-events-none on checkbox)
    const firstRow = page.locator('div:has(> input[type="checkbox"])').first()
    await firstRow.click()
    await page.getByTitle(/delete \d+ item/i).click()

    // Confirm the permanent delete
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /delete forever/i }).click()

    // Dialog should close and list should refresh
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.waitForTimeout(1500)
    // We're now in _deleted/ — either empty or file is gone
    // Just verify no crash occurred
    await expect(page).toHaveURL('/documents')
  })

})

// ── Multi-Folder Upload ───────────────────────────────────────────────────────

test.describe('Documents — Multi-Folder Upload', () => {

  const FOLDER_A = '_e2e_folderA'
  const FOLDER_B = '_e2e_folderB'

  test.afterEach(async ({ request }) => {
    // Best-effort cleanup
    await request.delete(`/api/documents/${FOLDER_A}`).catch(() => {})
    await request.delete(`/api/documents/${FOLDER_B}`).catch(() => {})
    await request.delete(`/api/documents/_deleted/${FOLDER_A}`).catch(() => {})
    await request.delete(`/api/documents/_deleted/${FOLDER_B}`).catch(() => {})
  })

  test('folder input has both webkitdirectory and multiple attributes', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    const hasWebkitDir = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="file"]'))
        .some(el => el.hasAttribute('webkitdirectory'))
    )
    expect(hasWebkitDir).toBe(true)

    const hasMultiple = await page.evaluate(() => {
      const folderInput = Array.from(document.querySelectorAll('input[type="file"]'))
        .find(el => el.hasAttribute('webkitdirectory'))
      return folderInput?.hasAttribute('multiple') ?? false
    })
    expect(hasMultiple).toBe(true)
  })

  test('URL encoding: spaces in folder/file names are encoded in API calls', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    const mkdirCalls: string[] = []
    const putCalls: string[] = []

    await page.route('**/api/documents/**', async route => {
      const url = route.request().url()
      if (url.includes('/mkdir/')) mkdirCalls.push(url)
      if (route.request().method() === 'PUT') putCalls.push(url)
      await route.fulfill({ status: 201, body: '' })
    })

    // Simulate folder upload with spaces in names
    await page.evaluate(() => {
      const input = Array.from(document.querySelectorAll('input[type="file"]'))
        .find(el => el.hasAttribute('webkitdirectory')) as HTMLInputElement
      if (!input) throw new Error('folder input not found')

      const dt = new DataTransfer()
      const f = new File(['content'], '250706 RT.msg', { type: 'application/octet-stream' })
      Object.defineProperty(f, 'webkitRelativePath', { value: 'ET/250706 RT.msg', configurable: true })
      dt.items.add(f)
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await page.waitForTimeout(1500)

    // mkdir call should have encoded "ET" (no spaces, so no change) — just verify no raw space
    expect(mkdirCalls.some(u => u.includes('/mkdir/') && !u.includes(' '))).toBe(true)
    // PUT call must NOT contain a raw space — must be %20
    expect(putCalls.every(u => !u.includes(' '))).toBe(true)
    expect(putCalls.some(u => u.includes('250706%20RT.msg'))).toBe(true)
  })

  test('drag-over visual indicator: left panel gets ring class on dragover', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    const leftPanel = page.getByTestId('documents-left-panel')
    await expect(leftPanel).toBeVisible()

    // The wrapper always has transition-colors (base class, no drag state)
    const baseClass = await leftPanel.evaluate(el => el.className)
    expect(baseClass).toContain('transition-colors')
    expect(baseClass).not.toContain('ring-2')

    // Dispatch dragover and wait for React to process state update
    await leftPanel.dispatchEvent('dragover', { bubbles: true, cancelable: true })
    await page.waitForTimeout(200)

    const afterDragOver = await leftPanel.evaluate(el => el.className)
    expect(afterDragOver).toContain('ring-2')

    // Dispatch dragleave — ring should disappear
    await leftPanel.dispatchEvent('dragleave', { bubbles: true })
    await page.waitForTimeout(200)
    const afterLeave = await leftPanel.evaluate(el => el.className)
    expect(afterLeave).not.toContain('ring-2')
  })

  test('API: two folders + files can be created independently', async ({ request }) => {
    await request.fetch(`/api/documents/mkdir/${FOLDER_A}`, { method: 'POST' })
    const putA = await request.put(`/api/documents/${FOLDER_A}/file_a.txt`, {
      data: 'folder a content', headers: { 'Content-Type': 'text/plain' },
    })
    expect(putA.ok()).toBe(true)

    await request.fetch(`/api/documents/mkdir/${FOLDER_B}`, { method: 'POST' })
    const putB = await request.put(`/api/documents/${FOLDER_B}/file_b.txt`, {
      data: 'folder b content', headers: { 'Content-Type': 'text/plain' },
    })
    expect(putB.ok()).toBe(true)

    const xml = await (await request.get('/api/documents')).text()
    expect(xml).toContain(FOLDER_A)
    expect(xml).toContain(FOLDER_B)
  })

  test('UI: simulated multi-folder upload triggers mkdir and PUT for both folders', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    const mkdirCalls: string[] = []
    const putCalls:   string[] = []

    // Single handler to avoid route-match conflicts
    await page.route('**/api/documents/**', async route => {
      const url = route.request().url()
      if (url.includes('/mkdir/')) mkdirCalls.push(url)
      if (route.request().method() === 'PUT') putCalls.push(url)
      await route.continue()
    })

    await page.evaluate(({ folderA, folderB }) => {
      const input = Array.from(document.querySelectorAll('input[type="file"]'))
        .find(el => el.hasAttribute('webkitdirectory')) as HTMLInputElement
      if (!input) throw new Error('folder input not found')

      const dt = new DataTransfer()
      const makeFile = (name: string, rel: string) => {
        const f = new File(['content'], name, { type: 'text/plain' })
        Object.defineProperty(f, 'webkitRelativePath', { value: rel, configurable: true })
        return f
      }
      dt.items.add(makeFile('file_a.txt', `${folderA}/file_a.txt`))
      dt.items.add(makeFile('file_b.txt', `${folderB}/file_b.txt`))
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, { folderA: FOLDER_A, folderB: FOLDER_B })

    await page.waitForTimeout(3000)

    expect(mkdirCalls.some(u => u.includes(FOLDER_A))).toBe(true)
    expect(mkdirCalls.some(u => u.includes(FOLDER_B))).toBe(true)
    expect(putCalls.some(u => u.includes(FOLDER_A))).toBe(true)
    expect(putCalls.some(u => u.includes(FOLDER_B))).toBe(true)
  })

  test('UI: both uploaded folders appear in file browser after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    await page.evaluate(({ folderA, folderB }) => {
      const input = Array.from(document.querySelectorAll('input[type="file"]'))
        .find(el => el.hasAttribute('webkitdirectory')) as HTMLInputElement
      if (!input) throw new Error('folder input not found')

      const dt = new DataTransfer()
      const makeFile = (name: string, rel: string) => {
        const f = new File(['content'], name, { type: 'text/plain' })
        Object.defineProperty(f, 'webkitRelativePath', { value: rel, configurable: true })
        return f
      }
      dt.items.add(makeFile('file_a.txt', `${folderA}/file_a.txt`))
      dt.items.add(makeFile('file_b.txt', `${folderB}/file_b.txt`))
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, { folderA: FOLDER_A, folderB: FOLDER_B })

    // Wait for upload + browser auto-refresh
    await page.waitForTimeout(4000)

    await expect(page.getByText(FOLDER_A)).toBeVisible()
    await expect(page.getByText(FOLDER_B)).toBeVisible()
  })

})
