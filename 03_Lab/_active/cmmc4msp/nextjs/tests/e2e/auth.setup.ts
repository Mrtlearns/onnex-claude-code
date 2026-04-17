/**
 * auth.setup.ts
 *
 * Runs once before all tests (project "setup"). Logs in via Authentik OIDC
 * and saves the browser storage state to tests/e2e/.auth/user.json so that
 * all other test projects can reuse the authenticated session.
 *
 * Required env vars:
 *   CMMC_TEST_EMAIL    — defaults to admin@cmmc4msp.on-nex.us
 *   CMMC_TEST_PASSWORD — must be provided
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

const TEST_EMAIL = process.env.CMMC_TEST_EMAIL || 'admin@cmmc4msp.on-nex.us'
const TEST_PASSWORD = process.env.CMMC_TEST_PASSWORD || ''

setup('authenticate', async ({ page }) => {
  if (!TEST_PASSWORD) {
    throw new Error(
      'CMMC_TEST_PASSWORD env var is required for E2E tests. ' +
        'Set it before running: CMMC_TEST_PASSWORD=xxx npx playwright test'
    )
  }

  // Navigate to the app — Next.js will redirect unauthenticated users to NextAuth signin
  await page.goto('/')

  // The page may already be authenticated (e.g., cached session) — check
  const isAlreadyLoggedIn = await page
    .getByRole('heading', { name: 'CMMC Compliance OS' })
    .isVisible()
    .catch(() => false)

  if (isAlreadyLoggedIn) {
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  // NextAuth signin page — click the "Sign in with Authentik" provider button
  // The exact button text depends on how NextAuth is configured; try common variants
  const signinBtn = page
    .getByRole('link', { name: /sign in/i })
    .or(page.getByRole('button', { name: /sign in/i }))
    .first()

  await signinBtn.waitFor({ timeout: 15000 })
  await signinBtn.click()

  // We are now on the Authentik login page (auth.cmmc4msp.on-nex.us)
  // Fill credentials — Authentik uses standard username/password fields
  await page.waitForURL(/auth\.cmmc4msp\.on-nex\.us/, { timeout: 20000 })

  await page.getByLabel(/username|email/i).fill(TEST_EMAIL)
  await page.getByLabel(/password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click()

  // Wait for redirect back to the app
  await page.waitForURL(/app\.cmmc4msp\.on-nex\.us/, { timeout: 30000 })

  // Confirm we landed on the dashboard
  await expect(page.getByRole('heading', { name: 'CMMC Compliance OS' })).toBeVisible({
    timeout: 20000,
  })

  // Persist the authenticated session
  await page.context().storageState({ path: AUTH_FILE })
})
