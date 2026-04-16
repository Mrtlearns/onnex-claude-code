import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['*auth-setup.spec.ts', '*login-flow.spec.ts'],
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://10.10.110.32:8888',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Crypto.subtle requires HTTPS; this flag makes the target origin a secure context
            '--unsafely-treat-insecure-origin-as-secure=http://10.10.110.32:8888',
          ],
        },
      },
    },
  ],

  webServer: undefined,
});
