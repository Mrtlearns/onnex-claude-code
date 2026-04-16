import { test, expect } from "@playwright/test";

// E2E smoke tests for the RAG pipeline.
// Requires a running dev server (bun run dev) at localhost:8080.
// Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env before running.

const BASE_URL = "http://localhost:8080";
const EMAIL = process.env.E2E_TEST_EMAIL ?? "test@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "test-password-change-me";

test.describe("Auth", () => {
  test("can load the auth page", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await expect(page.getByRole("heading", { name: /sign in/i }).or(page.getByText(/log in/i))).toBeVisible({ timeout: 10_000 });
  });

  test("can log in with test credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByPlaceholder(/email/i).fill(EMAIL);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // After login, should redirect away from /auth
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
  });
});

test.describe("Projects", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto(`${BASE_URL}/auth`);
    await page.getByPlaceholder(/email/i).fill(EMAIL);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.href.includes("/auth"), { timeout: 15_000 });
  });

  test("projects page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/projects`);
    await expect(page.getByRole("heading", { name: /project/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Settings — re-ranking toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByPlaceholder(/email/i).fill(EMAIL);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.href.includes("/auth"), { timeout: 15_000 });
  });

  test("settings RAG tab renders without crash", async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.getByRole("tab", { name: /rag/i }).click();
    // Re-ranking toggle should be visible
    await expect(page.getByText(/re.ranking/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Evaluation page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.getByPlaceholder(/email/i).fill(EMAIL);
    await page.getByPlaceholder(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.href.includes("/auth"), { timeout: 15_000 });
  });

  test("evaluation page renders Run tab", async ({ page }) => {
    await page.goto(`${BASE_URL}/evaluation`);
    await expect(page.getByRole("tab", { name: "Run" })).toBeVisible({ timeout: 10_000 });
  });

  test("Metrics tab renders without crash", async ({ page }) => {
    await page.goto(`${BASE_URL}/evaluation`);
    await page.getByRole("tab", { name: /metrics/i }).click();
    // Should show either empty state or charts — not throw an error
    await expect(
      page.getByText(/no evaluation data/i).or(page.getByText(/avg faithfulness/i))
    ).toBeVisible({ timeout: 10_000 });
  });
});
