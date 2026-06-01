import { defineConfig, devices } from '@playwright/test'

/**
 * E2E test harness for the public marketing site (@website/marketing).
 *
 * The marketing app has no auth and no database, so it runs fully offline
 * (no AWS / Clerk / DynamoDB). Playwright boots `next dev` on port 3000 and
 * drives a real Chromium against it.
 *
 * Run locally with: `npm run test:e2e` (from the repo root).
 */
const PORT = 3000
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -w @website/marketing',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
