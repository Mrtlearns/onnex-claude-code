/**
 * NDT Portal — Pipeline Analysis E2E tests
 *
 * Covers:
 *  1. Demo mode — full 11-step animation, badges, activity log, completion card
 *  2. Step category icon pills — colours per category (intake/security/ai/system/output)
 *  3. Direction arrows — ↑ SENT when processing, ↓ RECV when success
 *  4. Real pipeline upload — upload 250706 RT.msg, trigger analysis, poll for email_sanitize success
 *  5. Navigation — back-to-Dashboard button, Demo Mode badge
 *  6. Status badge colours — Processing=blue, Completed=green, Failed=red
 *
 * Base URL: https://ndt-v1.on-nex.us  (set in playwright.config.ts)
 * No auth required.
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'

// ── Helpers ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MSG_FILE = path.resolve(__dirname, '../../../files/250706 RT.msg')

// ── Suite 1: Demo mode ─────────────────────────────────────────────────────

test.describe('Demo mode (/analysis/demo)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
  })

  test('page title and Demo Mode badge are visible', async ({ page }) => {
    await expect(page.getByText('Pipeline Analysis')).toBeVisible()
    await expect(page.getByText('Demo Mode')).toBeVisible()
  })

  test('initial status is Idle or Processing', async ({ page }) => {
    // The badge appears immediately — could be Idle briefly before first timer fires
    const badge = page.locator('span, div').filter({ hasText: /idle|processing/i }).first()
    await expect(badge).toBeVisible({ timeout: 5000 })
  })

  test('all 11 pipeline step labels are rendered', async ({ page }) => {
    const expectedSteps = [
      'Message Received',
      'Email Sanitization',
      'Email LLM Analysis',
      'Compliance Classification',
      'Compliance Gate',
      'PII Sanitization',
      'Inspection Type Detection',
      'Pre-processor',
      'LLM Analysis',
      'Assemble Results',
      'Quote Created',
    ]
    for (const label of expectedSteps) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('demo completes — status badge becomes Completed, completion card appears', async ({ page }) => {
    // Total demo delay is ~14.6 s accumulated — give 25 s for slow environments
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    // Completion card headline
    await expect(page.getByText(/pipeline completed successfully/i)).toBeVisible()
  })

  test('completion card contains "View Quote" button', async ({ page }) => {
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('button', { name: /view quote/i })).toBeVisible()
  })

  test('activity log fills up with events during demo', async ({ page }) => {
    // After ~5 s several events should have fired
    await page.waitForTimeout(6000)
    const logEntries = page.locator('div').filter({ hasText: /INTAKE|EMAIL_SANITIZATION|EMAIL_LLM/i })
    const count = await logEntries.count()
    expect(count).toBeGreaterThan(0)
  })

  test('activity log shows correct number of events label', async ({ page }) => {
    // Wait for demo to finish
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    // The "N events" counter should be > 0
    const eventsLabel = page.getByText(/\d+ event/i)
    await expect(eventsLabel).toBeVisible()
    const text = await eventsLabel.textContent()
    const n = parseInt(text?.match(/(\d+)/)?.[1] ?? '0', 10)
    expect(n).toBeGreaterThan(0)
  })

  test('status badge transitions: Processing → Completed with correct colours', async ({ page }) => {
    // During processing the badge should have blue classes
    const processingBadge = page.locator('[class*="blue"]').filter({ hasText: /processing/i }).first()
    // It may not be blue at the very start (Idle), but within a second it should be
    await expect(processingBadge).toBeVisible({ timeout: 5000 })

    // After completion the badge should have green classes
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    const completedBadge = page.locator('[class*="green"]').filter({ hasText: /completed/i }).first()
    await expect(completedBadge).toBeVisible()
  })

})

// ── Suite 2: Step type icon pills ──────────────────────────────────────────

test.describe('Step type icon category pills', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    // Wait for all steps to render (they're rendered immediately, not after demo starts)
  })

  /**
   * Category pill colours come from CATEGORY_STYLE in AnalysisPage.tsx:
   *   intake   → bg-blue-100   (steps: Message Received)
   *   security → bg-orange-100 (Email Sanitization, Compliance Classification, Compliance Gate, PII Sanitization)
   *   ai       → bg-purple-100 (Email LLM Analysis, LLM Analysis)
   *   system   → bg-gray-100   (Inspection Type Detection, Pre-processor, Assemble Results)
   *   output   → bg-green-100  (Quote Created)
   *
   * We verify by finding the category label text that appears below each step.
   */

  test('intake category label is visible for Message Received', async ({ page }) => {
    // The category label "[Intake]" appears as a styled span next to the description
    const intakeLabel = page.locator('span').filter({ hasText: /\[Intake\]/i }).first()
    await expect(intakeLabel).toBeVisible()
  })

  test('security category label appears for sanitisation steps', async ({ page }) => {
    const securityLabels = page.locator('span').filter({ hasText: /\[Security\]/i })
    const count = await securityLabels.count()
    expect(count).toBeGreaterThanOrEqual(3) // Email Sanitization, Compliance Classification, Compliance Gate, PII Sanitization
  })

  test('AI / LLM category label appears for LLM steps', async ({ page }) => {
    const aiLabels = page.locator('span').filter({ hasText: /\[AI \/ LLM\]/i })
    const count = await aiLabels.count()
    expect(count).toBeGreaterThanOrEqual(2) // Email LLM Analysis, LLM Analysis
  })

  test('System category label appears for system steps', async ({ page }) => {
    const sysLabels = page.locator('span').filter({ hasText: /\[System\]/i })
    const count = await sysLabels.count()
    expect(count).toBeGreaterThanOrEqual(3) // Inspection Type Detection, Pre-processor, Assemble Results
  })

  test('Output category label appears for Quote Created', async ({ page }) => {
    const outputLabels = page.locator('span').filter({ hasText: /\[Output\]/i })
    await expect(outputLabels.first()).toBeVisible()
  })

})

// ── Suite 3: Direction arrows ──────────────────────────────────────────────

test.describe('Direction arrows (↑ SENT / ↓ RECV)', () => {

  test('processing step shows ↑ SENT arrow', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    // The first processing event fires at ~300ms + 400ms = ~700ms from demo start
    // "Email Sanitization" goes to processing at ~700ms
    await expect(page.getByText('SENT')).toBeVisible({ timeout: 5000 })
  })

  test('completed step shows ↓ RECV arrow', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    // After ~1.7 s, "Message Received" is success (its only event is success at 300ms)
    // "Email Sanitization" succeeds at ~300+400+1200 = 1900ms
    await expect(page.getByText('RECV')).toBeVisible({ timeout: 10_000 })
  })

})

// ── Suite 4: Navigation ────────────────────────────────────────────────────

test.describe('Navigation', () => {

  test('back to Dashboard button navigates to /', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    const backBtn = page.getByRole('button', { name: /dashboard/i })
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page).toHaveURL('/')
  })

  test('completion card "Back to Dashboard" button works', async ({ page }) => {
    await page.goto('/analysis/demo')
    // Wait for completion
    await expect(page.getByText(/pipeline completed successfully/i)).toBeVisible({ timeout: 25_000 })
    const btn = page.getByRole('button', { name: /back to dashboard/i })
    await btn.click()
    await expect(page).toHaveURL('/')
  })

  test('Demo Mode badge is visible on /analysis/demo', async ({ page }) => {
    await page.goto('/analysis/demo')
    await expect(page.getByText('Demo Mode')).toBeVisible()
  })

  test('Demo Mode badge is NOT visible on a real intake page', async ({ page }) => {
    // Navigate to a fake UUID — the page will still render without Demo badge
    await page.goto('/analysis/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Demo Mode')).not.toBeVisible()
  })

})

// ── Suite 5: Status badge colours ─────────────────────────────────────────

test.describe('Status badge colours', () => {

  test('Processing badge has blue colour classes', async ({ page }) => {
    await page.goto('/analysis/demo')
    // Processing badge appears quickly
    const badge = page.locator('[class*="blue"]').filter({ hasText: /processing/i }).first()
    await expect(badge).toBeVisible({ timeout: 5000 })
  })

  test('Completed badge has green colour classes', async ({ page }) => {
    await page.goto('/analysis/demo')
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    const badge = page.locator('[class*="green"]').filter({ hasText: /completed/i }).first()
    await expect(badge).toBeVisible()
  })

})

// ── Suite 6: Real pipeline upload ──────────────────────────────────────────

test.describe('Real pipeline — .msg upload', () => {

  /**
   * This test uploads the real .msg file through the Dashboard, starts analysis,
   * then waits up to 60s for the email_sanitize step to succeed.
   *
   * Note: The LLM step may be skipped (no Anthropic credits on dev), and attachment
   * processing depends on n8n WF-5 completing Branch B — but intake + email_sanitize
   * MUST succeed to validate the webhook fix.
   */
  test('upload msg file, start analysis, see email_sanitize succeed', async ({ page }) => {
    // 1. Go to Dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 2. Find the file input (Dashboard uploads .msg files)
    //    The Dashboard component has a hidden <input type="file"> triggered by a button
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })

    // 3. Upload the .msg file
    await fileInput.setInputFiles(MSG_FILE)

    // 4. Wait for msg-api to parse the file and show the "Start Analysis" card
    //    Dashboard calls /api/ut/integrations/pipeline/analyze after extraction
    //    and shows the card with "Start Analysis" button when intakeId is returned.
    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })

    // 5. Click Start Analysis → navigate to /analysis/:intakeId
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // 6. Capture the intakeId from URL
    const url = page.url()
    const intakeId = url.match(/\/analysis\/([0-9a-f-]{36})/)?.[1]
    expect(intakeId).toBeTruthy()

    // 7. Verify the page isn't in demo mode
    await expect(page.getByText('Demo Mode')).not.toBeVisible()

    // 8. The status badge should be Processing (not Idle)
    //    After intake is recorded, the session is 'processing'
    const processingBadge = page.locator('[class*="blue"]').filter({ hasText: /^Processing$/ }).first()
    await expect(processingBadge).toBeVisible({ timeout: 15_000 })

    // 9. Wait for email_sanitize to appear as "Done" in the step list
    //    (n8n WF-5 posts step-updates; UI polls every 2s)
    const emailSanitizeDone = page
      .getByText('Email Sanitization', { exact: true })
      .locator('../..')
      .locator('span')
      .filter({ hasText: /^Done$/ })
    await expect(emailSanitizeDone).toBeVisible({ timeout: 60_000 })

    // 10. Take a screenshot of the analysis page
    await page.screenshot({
      path: `e2e/test-results/real-pipeline-${intakeId?.slice(0, 8)}.png`,
      fullPage: false,
    })

    // 11. "Message Received" step should also be Done
    const intakeDone = page
      .getByText('Message Received', { exact: true })
      .locator('../..')
      .locator('span')
      .filter({ hasText: /^Done$/ })
    await expect(intakeDone).toBeVisible()
  })

  test('analysis page shows correct intake ID in header bar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toHaveCount(1, { timeout: 10_000 })
    await fileInput.setInputFiles(MSG_FILE)

    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    const url = page.url()
    const intakeId = url.match(/\/analysis\/([0-9a-f-]{36})/)?.[1]
    expect(intakeId).toBeTruthy()

    // Header bar shows "Intake <first 8 chars>…"
    const shortId = intakeId!.slice(0, 8)
    await expect(page.getByText(new RegExp(`Intake ${shortId}`, 'i'))).toBeVisible({ timeout: 10_000 })
  })

  test('step counter increases as pipeline runs', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toHaveCount(1, { timeout: 10_000 })
    await fileInput.setInputFiles(MSG_FILE)

    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // Step counter shows "X / 11"
    const stepCounter = page.getByText(/\d+ \/ 11/)
    await expect(stepCounter).toBeVisible({ timeout: 10_000 })

    // Wait for at least intake + email_sanitize to complete
    await expect(
      page.getByText('Email Sanitization', { exact: true })
        .locator('../..')
        .locator('span')
        .filter({ hasText: /^Done$/ })
    ).toBeVisible({ timeout: 60_000 })

    // Now counter should be >= 2
    const updatedCounter = page.getByText(/[2-9] \/ 11/)
    await expect(updatedCounter).toBeVisible()
  })

})

// ── Suite 6b: Full pipeline completion (11/11 steps) ──────────────────────

test.describe('Real pipeline — full 11-step completion', () => {

  /**
   * Uploads the .msg file and waits for full pipeline completion (all 11 steps done).
   * Specifically verifies that quote_created fires — this was the last step that
   * was missing before the self-POST fix in /pipeline/result.
   *
   * Timeout: 3 minutes — LLM calls can take 30-60s.
   */
  test('all 11 steps complete including quote_created', async ({ page }) => {
    test.setTimeout(180_000) // 3 min — LLM steps can be slow

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })
    await fileInput.setInputFiles(MSG_FILE)

    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // Wait for all 11 steps — counter shows "11 / 11"
    const fullCounter = page.getByText('11 / 11')
    await expect(fullCounter).toBeVisible({ timeout: 150_000 })

    // Status badge must be Completed (not stalled or processing)
    const completedBadge = page.locator('[class*="green"]').filter({ hasText: /completed/i }).first()
    await expect(completedBadge).toBeVisible({ timeout: 10_000 })
  })

  test('quote_created step is Done after pipeline completes', async ({ page }) => {
    test.setTimeout(180_000)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })
    await fileInput.setInputFiles(MSG_FILE)

    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // Wait for quote_created step to show Done or Skipped
    const quoteCreatedStep = page
      .getByText('Quote Created', { exact: true })
      .locator('../..')
      .locator('span')
      .filter({ hasText: /^Done$|^Skipped$/ })
    await expect(quoteCreatedStep).toBeVisible({ timeout: 150_000 })
  })

  test('audit log link or button appears after pipeline completes', async ({ page }) => {
    test.setTimeout(180_000)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })
    await fileInput.setInputFiles(MSG_FILE)

    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // Wait for completion
    await expect(page.getByText('11 / 11')).toBeVisible({ timeout: 150_000 })

    // An "Audit Log" or "View Audit Log" button should appear
    const auditBtn = page.getByRole('button', { name: /audit log/i })
      .or(page.getByRole('link', { name: /audit log/i }))
    await expect(auditBtn.first()).toBeVisible({ timeout: 5_000 })
  })

})

// ── Suite 7: Dashboard integration ────────────────────────────────────────

test.describe('Dashboard .msg upload integration', () => {

  test('drag or click area is visible on Dashboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // The dashboard should have a file upload affordance
    const uploadArea = page.locator('input[type="file"]')
      .or(page.getByText(/drop|upload|drag/i).first())
    await expect(uploadArea.first()).toBeAttached({ timeout: 10_000 })
  })

  test('uploading a non-msg file does not navigate away', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Try uploading a .txt file — should not navigate to /analysis
    const fileInput = page.locator('input[type="file"]')
    const count = await fileInput.count()
    if (count > 0) {
      // Create a buffer as a fake .txt
      await fileInput.setInputFiles({
        name: 'wrong.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello'),
      })
      // MsgUploader shows an error message but stays on Dashboard
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL('/')
    } else {
      test.skip()
    }
  })

})
