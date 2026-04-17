/**
 * auth.spec.ts
 *
 * Tests for the authentication flow:
 * - Login with valid credentials → dashboard redirect
 * - Login with invalid credentials → error shown
 * - Session persists on reload
 *
 * NOTE: The "valid login" and "session persists" tests run with the pre-saved
 * storageState (already authenticated). The "invalid credentials" test uses a
 * fresh browser context to avoid polluting the shared session.
 */
import { test, expect, chromium } from '@playwright/test'

// ── Tests that rely on the pre-authenticated storageState ─────────────────────

test('after login, main dashboard loads at /', async ({ page }) => {
  await page.goto('/')
  // Should land on the MSP dashboard — not on a login page
  await expect(page.getByRole('heading', { name: 'CMMC Compliance OS' })).toBeVisible({
    timeout: 20000,
  })
})

test('session persists on page reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'CMMC Compliance OS' })).toBeVisible({
    timeout: 20000,
  })

  await page.reload()

  // After reload the session cookie re-hydrates and we stay on the dashboard
  await expect(page.getByRole('heading', { name: 'CMMC Compliance OS' })).toBeVisible({
    timeout: 20000,
  })
  // Should NOT see the NextAuth sign-in page
  await expect(page.getByRole('button', { name: /sign in/i })).not.toBeVisible()
})

// ── Test that requires a fresh (unauthenticated) context ──────────────────────

test('login with invalid credentials shows an error', async ({ browser }) => {
  // Use a fresh context with no stored auth state
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    const BASE = process.env.CMMC_BASE_URL || 'https://app.cmmc4msp.on-nex.us'

    await page.goto(BASE)

    // Navigate to NextAuth signin
    const signinBtn = page
      .getByRole('link', { name: /sign in/i })
      .or(page.getByRole('button', { name: /sign in/i }))
      .first()

    // If we're already redirected to NextAuth, that's fine too
    await signinBtn.waitFor({ timeout: 15000 }).catch(() => {})

    const onNextAuthPage = page.url().includes('/api/auth/signin') || page.url().includes('signin')
    if (!onNextAuthPage) {
      await signinBtn.click()
    }

    // Wait for Authentik
    await page.waitForURL(/auth\.cmmc4msp\.on-nex\.us/, { timeout: 20000 })

    await page.getByLabel(/username|email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrong-password-xyz-123')
    await page.getByRole('button', { name: /sign in|log in|continue/i }).click()

    // Authentik should show an error — either inline or a redirect with error query param
    const errorVisible = await page
      .getByText(/incorrect|invalid|failed|wrong|error/i)
      .isVisible({ timeout: 10000 })
      .catch(() => false)

    const urlHasError = page.url().includes('error') || page.url().includes('Error')

    expect(errorVisible || urlHasError).toBeTruthy()

    // Should NOT have landed on the app dashboard
    await expect(
      page.getByRole('heading', { name: 'CMMC Compliance OS' })
    ).not.toBeVisible()
  } finally {
    await ctx.close()
  }
})
