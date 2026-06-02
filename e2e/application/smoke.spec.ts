import { test, expect } from '@playwright/test'
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'

/**
 * Authed smoke suite for the application app (@website/application).
 *
 * Signs in headlessly with `@clerk/testing/playwright` using the fixed dev OTP
 * path for `+clerk_test` addresses (handled internally by Clerk — no real inbox
 * or password). Asserts only on STABLE, unconditional headings / empty-state
 * copy so the suite stays deterministic against an empty dynalite:
 *
 *  - /alerts    → <h1>Alert rules</h1> (renders unconditionally) plus the
 *                 empty-state "No alert rules yet — create one above." which is
 *                 what an empty DB shows. No external secrets needed on load.
 *  - /live-feed → <h1>Live feed</h1> (renders unconditionally). Avoids asserting
 *                 on feed rows, which depend on watchlist/ingested data.
 *
 * Deliberately avoids /analytics (its /api/query needs NEYNAR_API_KEY +
 * HUM_MODEL) and any data-dependent assertion.
 *
 * The dynalite DB and Clerk testing token are wired by ./global-setup.ts and
 * playwright.application.config.ts.
 */

// Fail loudly (don't silently skip) if required Clerk config is absent — this
// mirrors global-setup's guard, in case the spec is run with a stale server.
const CLERK_TEST_EMAIL = process.env.CLERK_TEST_EMAIL
for (const key of [
  'CLERK_TEST_EMAIL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
] as const) {
  if (!process.env[key]) {
    throw new Error(
      `[application e2e] Missing required Clerk env var ${key}. The authed suite ` +
        `cannot run without it (no silent skip).`,
    )
  }
}

test.describe('application authed smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the Clerk testing token so the dev instance accepts our session
    // without bot protection interfering.
    await setupClerkTestingToken({ page })

    // clerk.signIn requires Clerk to be loaded first: navigate to a NON-protected
    // page that mounts ClerkProvider before signing in. The app root (`/`)
    // redirects unauthenticated users straight to `/sign-in`, so go there
    // directly — it boots ClerkProvider, which is what signIn needs.
    await page.goto('/sign-in')

    await clerk.signIn({
      page,
      signInParams: { strategy: 'email_code', identifier: CLERK_TEST_EMAIL! },
    })
  })

  test('/alerts renders the "Alert rules" heading and empty state', async ({ page }) => {
    await page.goto('/alerts')

    await expect(page.getByRole('heading', { name: 'Alert rules', level: 1 })).toBeVisible()
    await expect(page.getByText('No alert rules yet — create one above.')).toBeVisible()
  })

  test('/live-feed renders the "Live feed" heading', async ({ page }) => {
    await page.goto('/live-feed')

    await expect(page.getByRole('heading', { name: 'Live feed', level: 1 })).toBeVisible()
  })
})
