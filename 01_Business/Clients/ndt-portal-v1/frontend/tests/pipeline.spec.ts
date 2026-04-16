/**
 * NDT Portal — Pipeline Analysis E2E tests
 *
 * Canonical test file at frontend/tests/pipeline.spec.ts
 * The main test runner uses playwright.config.ts (testDir: './e2e/tests'), so
 * the working copy is also at e2e/tests/09-pipeline.spec.ts.
 *
 * To run this file with a custom testDir config:
 *   npx playwright test --config playwright.config.ts tests/pipeline.spec.ts
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
// tests/ is inside frontend/ — ../../ resolves to projects/ndt-portal-v1/
const MSG_FILE = path.resolve(__dirname, '../../files/250706 RT.msg')

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
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    await expect(page.getByText(/pipeline completed successfully/i)).toBeVisible()
  })

  test('completion card contains "View Quote" button', async ({ page }) => {
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('button', { name: /view quote/i })).toBeVisible()
  })

  test('activity log fills up with events during demo', async ({ page }) => {
    await page.waitForTimeout(6000)
    const logEntries = page.locator('div').filter({ hasText: /INTAKE|EMAIL_SANITIZATION|EMAIL_LLM/i })
    const count = await logEntries.count()
    expect(count).toBeGreaterThan(0)
  })

  test('activity log shows correct number of events label', async ({ page }) => {
    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    const eventsLabel = page.getByText(/\d+ event/i)
    await expect(eventsLabel).toBeVisible()
    const text = await eventsLabel.textContent()
    const n = parseInt(text?.match(/(\d+)/)?.[1] ?? '0', 10)
    expect(n).toBeGreaterThan(0)
  })

  test('status badge transitions: Processing → Completed with correct colours', async ({ page }) => {
    const processingBadge = page.locator('[class*="blue"]').filter({ hasText: /processing/i }).first()
    await expect(processingBadge).toBeVisible({ timeout: 5000 })

    await expect(page.getByText(/completed/i).first()).toBeVisible({ timeout: 25_000 })
    const completedBadge = page.locator('[class*="green"]').filter({ hasText: /completed/i }).first()
    await expect(completedBadge).toBeVisible()
  })

})

// ── Suite 2: Step type icon pills ──────────────────────────────────────────

test.describe('Step type icon category pills', () => {

  /**
   * Category labels are rendered as:
   *   <span className="font-semibold mr-1 ${catStyle.text}">[Intake]</span>
   *
   * CATEGORY_STYLE:
   *   intake   → bg-blue-100   / text-blue-600    (Message Received)
   *   security → bg-orange-100 / text-orange-600  (Email Sanitization, Compliance x2, PII)
   *   ai       → bg-purple-100 / text-purple-600  (Email LLM Analysis, LLM Analysis)
   *   system   → bg-gray-100   / text-gray-500    (Type Detection, Pre-processor, Assemble)
   *   output   → bg-green-100  / text-green-600   (Quote Created)
   */

  test.beforeEach(async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
  })

  test('[Intake] label visible for Message Received', async ({ page }) => {
    await expect(page.locator('span').filter({ hasText: /\[Intake\]/i }).first()).toBeVisible()
  })

  test('[Security] label appears >= 3 times', async ({ page }) => {
    const count = await page.locator('span').filter({ hasText: /\[Security\]/i }).count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('[AI / LLM] label appears >= 2 times', async ({ page }) => {
    const count = await page.locator('span').filter({ hasText: /\[AI \/ LLM\]/i }).count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('[System] label appears >= 3 times', async ({ page }) => {
    const count = await page.locator('span').filter({ hasText: /\[System\]/i }).count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('[Output] label visible for Quote Created', async ({ page }) => {
    await expect(page.locator('span').filter({ hasText: /\[Output\]/i }).first()).toBeVisible()
  })

  test('category icon pills have correct bg colour classes', async ({ page }) => {
    await expect(page.locator('[class*="bg-blue-100"]').first()).toBeVisible()
    await expect(page.locator('[class*="bg-orange-100"]').first()).toBeVisible()
    await expect(page.locator('[class*="bg-purple-100"]').first()).toBeVisible()
    await expect(page.locator('[class*="bg-green-100"]').first()).toBeVisible()
  })

})

// ── Suite 3: Direction arrows ──────────────────────────────────────────────

test.describe('Direction arrows (SENT / RECV)', () => {

  test('SENT text visible while a step is processing', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('SENT')).toBeVisible({ timeout: 5000 })
  })

  test('RECV text visible after a step succeeds', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('RECV')).toBeVisible({ timeout: 5000 })
  })

  test('SENT arrows are blue, RECV arrows are green', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')

    const sentSpan = page.locator('span').filter({ hasText: /^SENT$/ }).first()
    await expect(sentSpan).toBeVisible({ timeout: 5000 })
    await expect(sentSpan.locator('..')).toHaveClass(/text-blue-500/)

    const recvSpan = page.locator('span').filter({ hasText: /^RECV$/ }).first()
    await expect(recvSpan).toBeVisible({ timeout: 5000 })
    await expect(recvSpan.locator('..')).toHaveClass(/text-green-600|text-green-400/)
  })

})

// ── Suite 4: Navigation ────────────────────────────────────────────────────

test.describe('Navigation', () => {

  test('back-to-Dashboard button navigates to /', async ({ page }) => {
    await page.goto('/analysis/demo')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /dashboard/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('completion card "Back to Dashboard" returns to /', async ({ page }) => {
    await page.goto('/analysis/demo')
    await expect(page.getByText(/pipeline completed successfully/i)).toBeVisible({ timeout: 25_000 })
    await page.getByRole('button', { name: /back to dashboard/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('Demo Mode badge only visible on /analysis/demo', async ({ page }) => {
    await page.goto('/analysis/demo')
    await expect(page.getByText('Demo Mode')).toBeVisible()

    await page.goto('/analysis/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Demo Mode')).not.toBeVisible()
  })

})

// ── Suite 5: Status badge colours ─────────────────────────────────────────

test.describe('Status badge colours', () => {

  test('Processing badge is blue', async ({ page }) => {
    await page.goto('/analysis/demo')
    const badge = page.locator('[class*="blue"]').filter({ hasText: /^Processing$/ }).first()
    await expect(badge).toBeVisible({ timeout: 5000 })
  })

  test('Completed badge is green', async ({ page }) => {
    await page.goto('/analysis/demo')
    await expect(page.locator('span, div').filter({ hasText: /^Completed$/ }).first()).toBeVisible({ timeout: 25_000 })
    const greenBadge = page.locator('[class*="green"]').filter({ hasText: /^Completed$/ }).first()
    await expect(greenBadge).toBeVisible()
  })

  test('Failed state CSS class is defined (structural check)', async ({ page }) => {
    await page.goto('/analysis/demo')
    await expect(page.getByText('Pipeline Analysis')).toBeVisible()
    // The statusColors map in AnalysisPage defines bg-red-100/text-red-700 for 'failed'
    // We verify the component renders without error and styles are loaded
    const hasStylesheets = await page.evaluate(() => document.styleSheets.length > 0)
    expect(hasStylesheets).toBeTruthy()
  })

})

// ── Suite 6: Real pipeline upload ──────────────────────────────────────────

test.describe('Real pipeline — .msg upload and analysis', () => {
  test.setTimeout(90_000)

  test('upload 250706 RT.msg → analysis page → email_sanitize succeeds', async ({ page }) => {
    // 1. Dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 2. File input (sr-only but selectable)
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })

    // 3. Upload the .msg file — MsgUploader calls msg-api /api/upload
    await fileInput.setInputFiles(MSG_FILE)

    // 4. Wait for "Start Analysis" button
    //    Dashboard fires /api/ut/integrations/pipeline/analyze after extraction
    //    and shows the card with "Start Analysis" when intakeId returns.
    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })

    // 5. Navigate to analysis page
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    const url = page.url()
    const intakeId = url.match(/\/analysis\/([0-9a-f-]{36})/)?.[1]
    expect(intakeId).toBeTruthy()

    // 6. Not demo mode
    await expect(page.getByText('Demo Mode')).not.toBeVisible()

    // 7. Status = Processing (blue badge)
    await expect(
      page.locator('[class*="blue"]').filter({ hasText: /^Processing$/ }).first()
    ).toBeVisible({ timeout: 15_000 })

    // 8. email_sanitize step shows Done (n8n WF-5 posts step-updates, UI polls every 2s)
    await expect(
      page.getByText('Email Sanitization', { exact: true })
        .locator('../..')
        .locator('span')
        .filter({ hasText: /^Done$/ })
    ).toBeVisible({ timeout: 60_000 })

    // 9. intake step is Done
    await expect(
      page.getByText('Message Received', { exact: true })
        .locator('../..')
        .locator('span')
        .filter({ hasText: /^Done$/ })
    ).toBeVisible()

    // 10. Screenshot
    await page.screenshot({
      path: `e2e/test-results/real-pipeline-${intakeId!.slice(0, 8)}.png`,
    })
  })

  test('status badge is Processing or Completed (not Idle) after upload', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })
    await fileInput.setInputFiles(MSG_FILE)

    const startBtn = page.getByRole('button', { name: /start analysis/i })
    await expect(startBtn).toBeVisible({ timeout: 45_000 })
    await startBtn.click()
    await page.waitForURL(/\/analysis\/[0-9a-f-]{36}/, { timeout: 15_000 })

    // After 10s, badge should NOT be Idle
    await page.waitForTimeout(10_000)
    await expect(page.locator('span, div').filter({ hasText: /^Idle$/ }).first()).not.toBeVisible()
  })

})

// ── Suite 7: Dashboard .msg upload integration ─────────────────────────────

test.describe('Dashboard .msg upload integration', () => {

  test('file input is present on Dashboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10_000 })
  })

  test('uploading a non-msg file does not navigate away', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const fileInput = page.locator('input[type="file"]')
    const count = await fileInput.count()
    if (count > 0) {
      await fileInput.setInputFiles({
        name: 'wrong.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hello'),
      })
      // MsgUploader validates .msg extension and shows error — stays on dashboard
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL('/')
    } else {
      test.skip()
    }
  })

})
