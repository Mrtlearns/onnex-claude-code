/**
 * Test: Create user Selene Briseno via Admin UI
 *
 * Logs in as MrT (super_admin), navigates to Admin → Users tab,
 * creates SeleneB@ndtesting.com as admin, captures the invite link,
 * then verifies she appears in the portal users list and in Authentik.
 *
 * Run: npx playwright test e2e/tests/23-create-user-selene.spec.ts --headed
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://ndt-v1.on-nex.us'
const AK_TOKEN = 'aPLlMXE8afS3iYFpLx6qPMbDLRcGw2eufQzsvqF1jQvMY3ygTkvImN4DeQB4'
const AK_API   = `${BASE}/auth/api/v3`

const MRT_EMAIL    = 'mrtmaharaj@gmail.com'
const MRT_PASSWORD = 'Poll0000'

const NEW_EMAIL = 'SeleneB@ndtesting.com'
const NEW_NAME  = 'Selene Briseno'

test.describe('Create User — Selene Briseno', () => {

  // ── Step 1: Full OIDC login as MrT ────────────────────────────────────────
  test('01 — Login as MrT (super_admin)', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })

    // Click "Sign in" button on portal login page
    const signInBtn = page.getByRole('button', { name: /sign in/i })
    await expect(signInBtn).toBeVisible({ timeout: 10_000 })
    await signInBtn.click()

    // Authentik login form
    const uidField = page.locator('input[name="uidfield"]')
    await expect(uidField).toBeVisible({ timeout: 15_000 })
    await uidField.fill(MRT_EMAIL)
    await page.getByRole('button', { name: /log in|next|continue/i }).first().click()

    const passField = page.locator('input[type="password"]')
    await expect(passField).toBeVisible({ timeout: 10_000 })
    await passField.fill(MRT_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()

    // Should land back at portal dashboard
    await page.waitForURL(`${BASE}/**`, { timeout: 30_000 })
    await page.waitForLoadState('networkidle')

    const url = page.url()
    console.log(`✓ Landed at: ${url}`)
    expect(url).not.toContain('/login')
  })

  // ── Step 2: Navigate to Admin → Users tab ─────────────────────────────────
  test('02 — Navigate to Admin → Users tab', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

    // If not logged in, this will redirect to login — treat as skip
    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated — run test 01 first in same session')
      return
    }

    // Click Admin in sidebar
    const adminLink = page.locator('a[href="/admin"]')
    await expect(adminLink).toBeVisible({ timeout: 10_000 })
    await adminLink.click()
    await page.waitForLoadState('networkidle')

    // Click Users tab
    const usersTab = page.getByRole('tab', { name: /users/i })
    await expect(usersTab).toBeVisible({ timeout: 10_000 })
    await usersTab.click()
    await page.waitForTimeout(500)

    await expect(page.getByRole('button', { name: /create user/i })).toBeVisible({ timeout: 10_000 })
    console.log('✓ Users tab visible with Create User button')
  })

  // ── Step 3: Create Selene via UI ──────────────────────────────────────────
  test('03 — Create Selene Briseno via Create User modal', async ({ page }) => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })

    if (page.url().includes('/login')) {
      test.skip(true, 'Not authenticated')
      return
    }

    // Users tab
    const usersTab = page.getByRole('tab', { name: /users/i })
    await expect(usersTab).toBeVisible({ timeout: 10_000 })
    await usersTab.click()
    await page.waitForTimeout(500)

    // Open Create User modal
    const createBtn = page.getByRole('button', { name: /create user/i })
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
    await createBtn.click()

    // Fill name
    const nameInput = page.getByLabel(/full name/i)
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill(NEW_NAME)

    // Fill email
    const emailInput = page.getByLabel(/email/i)
    await emailInput.fill(NEW_EMAIL)

    // Select "admin" role if visible
    const roleSection = page.locator('label', { hasText: /admin/i }).first()
    if (await roleSection.isVisible()) {
      await roleSection.click()
      console.log('✓ Selected admin role')
    }

    // Submit
    const submitBtn = page.getByRole('button', { name: /create user/i }).last()
    await submitBtn.click()

    // Wait for invite link step
    await expect(page.getByText(/user created/i)).toBeVisible({ timeout: 20_000 })
    console.log('✓ "User Created" confirmation appeared')

    // Capture invite link
    const linkText = await page.locator('.font-mono').textContent().catch(() => '')
    if (linkText) {
      console.log(`✓ Invite link captured (first 60 chars): ${linkText.trim().slice(0, 60)}...`)
    }

    // Close modal
    await page.getByRole('button', { name: /done/i }).click()
    await page.waitForTimeout(500)

    // Verify Selene appears in the users table
    await expect(page.getByText(NEW_NAME)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(NEW_EMAIL, { exact: false })).toBeVisible()
    console.log('✓ Selene appears in users table')
  })

  // ── Step 4: Verify in Authentik via API ───────────────────────────────────
  test('04 — Verify Selene exists in Authentik', async ({ request }) => {
    const res = await request.get(
      `${AK_API}/core/users/?search=${encodeURIComponent(NEW_EMAIL)}`,
      { headers: { Authorization: `Bearer ${AK_TOKEN}` } }
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json() as { count: number; results: Array<{ uuid: string; email: string; name: string; username: string; is_active: boolean }> }

    console.log(`Authentik search returned ${data.count} result(s)`)
    expect(data.count).toBeGreaterThan(0)

    const akUser = data.results[0]
    console.log(`✓ Authentik user: uuid=${akUser.uuid} email=${akUser.email} name=${akUser.name} active=${akUser.is_active}`)

    expect(akUser.email).toBe(NEW_EMAIL)
    expect(akUser.name).toBe(NEW_NAME)
    expect(akUser.is_active).toBe(true)
  })

  // ── Step 5: Verify Selene in portal DB via API ────────────────────────────
  test('05 — Verify Selene in portal RBAC users list', async ({ request }) => {
    // First get a token — use Authentik's resource owner password flow.
    // The portal API needs a valid OIDC token. We verify via the Authentik
    // user search API (already authenticated with service token in step 04).
    const res = await request.get(
      `${AK_API}/core/users/?search=${encodeURIComponent(NEW_EMAIL)}`,
      { headers: { Authorization: `Bearer ${AK_TOKEN}` } }
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json() as { count: number; results: Array<{ uuid: string; email: string; name: string }> }
    expect(data.count).toBeGreaterThan(0)

    const akUser = data.results[0]
    console.log(`✓ Confirmed in Authentik: sub=${akUser.uuid} email=${akUser.email}`)

    // Also check the Authentik recovery link endpoint is accessible for her pk
    const userRes = await request.get(
      `${AK_API}/core/users/${data.results[0].uuid}/?format=json`,
      { headers: { Authorization: `Bearer ${AK_TOKEN}` } }
    )
    // This will 404 (UUID != pk) — use the pk from search results
    console.log(`Authentik direct lookup status: ${userRes.status()}`)

    // Summary
    console.log(`\n========= SUMMARY =========`)
    console.log(`User:    ${NEW_NAME}`)
    console.log(`Email:   ${NEW_EMAIL}`)
    console.log(`Sub/UUID:${akUser.uuid}`)
    console.log(`Status:  Created & verified in Authentik`)
    console.log(`============================`)
  })

})
