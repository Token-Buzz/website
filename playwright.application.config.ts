import { defineConfig, devices } from '@playwright/test'

/**
 * E2E test harness for the AUTHED application app (@website/application).
 *
 * Unlike the marketing suite (playwright.config.ts), this suite needs:
 *  - a local DynamoDB (dynalite) so the app's `@monorepo-template/core/db`
 *    client resolves table names and authed pages can read/write,
 *  - Clerk dev keys (pk_test / sk_test) + a `+clerk_test` email so we can sign
 *    in headlessly via `@clerk/testing/playwright`.
 *
 * It is deliberately a SEPARATE config from the marketing one so the marketing
 * suite (which runs on every PR) never boots dynalite or the application server.
 *
 * Run locally with: `npm run test:e2e:application` (from the repo root).
 * dynalite is booted/torn down by `./e2e/application/global-setup.ts`.
 */
const PORT = 3002
const baseURL = `http://localhost:${PORT}`

// dynalite + SST Resource env, copied from packages/core/test/integration-env.ts.
// The application's dev server (next dev) must inherit these so its
// `@monorepo-template/core/db` client points at the local dynalite instance and
// resolves the five table names. Without them, client.ts throws at import time.
const dynaliteEnv: Record<string, string> = {
  AWS_ENDPOINT_URL_DYNAMODB: 'http://127.0.0.1:8000',
  AWS_REGION: 'us-east-1',
  AWS_DEFAULT_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'local',
  AWS_SECRET_ACCESS_KEY: 'local',
  SST_RESOURCE_Tweets: JSON.stringify({ name: 'Tweets', type: 'sst.aws.Dynamo' }),
  SST_RESOURCE_Aggregates: JSON.stringify({ name: 'Aggregates', type: 'sst.aws.Dynamo' }),
  SST_RESOURCE_Tokens: JSON.stringify({ name: 'Tokens', type: 'sst.aws.Dynamo' }),
  SST_RESOURCE_UserData: JSON.stringify({ name: 'UserData', type: 'sst.aws.Dynamo' }),
  SST_RESOURCE_Feeds: JSON.stringify({ name: 'Feeds', type: 'sst.aws.Dynamo' }),
  SST_RESOURCE_App: JSON.stringify({ name: 'website', stage: 'test' }),
}

// Playwright's webServer.env requires Record<string, string> (no undefined), but
// process.env is Record<string, string | undefined>. Strip undefined values so
// the ambient Clerk keys are forwarded while keeping the config strictly typed.
const inheritedEnv: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
)

export default defineConfig({
  testDir: './e2e/application',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-application', open: 'never' }],
  ],
  globalSetup: './e2e/application/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // The sandbox/CI network intercepts and HTTPS-upgrades navigations, so a
    // plain http://localhost:3002 nav otherwise fails with
    // ERR_CERT_AUTHORITY_INVALID. The app is served over plain HTTP and stays
    // on HTTP; ignoring cert errors lets the navigation complete without
    // weakening any assertion (we still assert on real rendered content).
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -w @website/application',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Spread process.env first so the child dev-server inherits the ambient
      // Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY) from
      // the environment / CI secrets, then override with the dynalite + SST
      // resource bindings.
      ...inheritedEnv,
      ...dynaliteEnv,
    },
  },
})
