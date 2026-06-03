# Testing

TokenBuzz is an npm-workspaces monorepo (`packages/marketing`, `packages/application`, `packages/core`, `packages/jobs`, `packages/scripts`). All test commands run from the repo root.

Automated testing is organised as a pyramid of three layers — many fast unit tests at the base, fewer integration tests in the middle, and a thin end-to-end smoke layer on top:

- **Unit tests** — fast, pure-logic checks with no external dependencies.
- **Integration tests** — exercise the real DynamoDB data-access code against an in-memory database.
- **End-to-end (E2E) tests** — drive a real browser. There are two suites: one against the public **marketing** site, and one against the Clerk-authed **application** app.

All layers run without AWS credentials. The unit, integration, and marketing-E2E layers gate CI on every push and PR; the authed application E2E suite gates only on `master` pushes that opt in via the `[E2E]` commit tag (see below).

## Running the tests

| Layer | Command | What it covers | Needs |
|---|---|---|---|
| Unit | `npm run test:unit` | Pure logic: calculations, parsers, data transforms, DynamoDB key builders | Nothing (no SST stage, no AWS) |
| Integration | `npm run test:integration` | Real `packages/core/src/db` access patterns against in-memory DynamoDB | Nothing (fully offline via dynalite) |
| E2E (marketing) | `npm run test:e2e` | Public marketing site smoke flows in a real browser | Chromium (`npx playwright install chromium` once) |
| E2E (application, authed) | `npm run test:e2e:application` | Clerk-authed app smoke flows (`/alerts`, `/live-feed`) in a real browser | Clerk dev/test keys in the environment + Chromium |

### Unit tests

Run with `npm run test:unit`. Powered by [Vitest](https://vitest.dev) (`vitest run`), with test files living alongside the code in each workspace. They cover pure logic — calculations, parsers, data transforms, and DynamoDB key builders — and require no SST stage and no AWS access. This is the fastest layer and the base of the pyramid.

### Integration tests

Run with `npm run test:integration`. These use Vitest plus **dynalite** (an in-memory DynamoDB) and live in `packages/core` as files named `*.integration.test.ts`, run via `vitest.integration.config.ts`.

Rather than testing pure helpers in isolation, they exercise the **real** `packages/core/src/db` functions — the actual `ddb` client, key builders, and GSI queries — against a local in-memory DynamoDB. This catches bugs unit tests can't, for example a write that omits a GSI key so the corresponding index query can never see it.

The suite runs fully offline (no AWS, no `sst shell`): the harness boots dynalite, recreates the `infra/db.ts` tables and GSIs, and points the production DynamoDB client at it purely via environment variables.

### End-to-end (E2E) tests

There are now **two** E2E suites, both powered by [Playwright](https://playwright.dev) driving Chromium.

#### Marketing E2E (`npm run test:e2e`)

Run with `npm run test:e2e`. The config is the root `playwright.config.ts`; tests live under `e2e/` (for example `e2e/marketing/smoke.spec.ts`).

This suite targets the **marketing** app only. Because the marketing app has no auth and no database, it runs fully offline: Playwright's `webServer` boots `next dev` on port 3000 and drives a real browser against it. It runs on **every push and every pull request** and gates the deploy.

The current smoke suite covers:

- The homepage hero and primary CTA.
- The main navigation.
- The footer.
- Footer → contact navigation.
- The coming-soon page.

It deliberately avoids the `/changelog` page (which needs a GitHub token at request time) and does **not** submit the contact form (which needs Turnstile and Resend).

#### Application (authed) E2E (`npm run test:e2e:application`)

Run with `npm run test:e2e:application`. The config is `playwright.application.config.ts`; tests live under `e2e/application/`.

This suite targets the Clerk-authenticated **application** app and still runs **fully offline** — no AWS, no live deploy:

- A Playwright `globalSetup` (`e2e/application/global-setup.ts`) boots **dynalite** (in-memory DynamoDB) and recreates the `infra/db.ts` tables and GSIs, then points the app's `next dev` (port 3002) at it via environment variables.
- Sign-in is headless via [`@clerk/testing/playwright`](https://clerk.com/docs/testing/playwright/overview): `clerkSetup()` runs once, then each test calls `setupClerkTestingToken({ page })` and `clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: CLERK_TEST_EMAIL } })`. Clerk's fixed dev OTP `424242` for `+clerk_test` addresses is used internally, so no real inbox or password is needed.

The current smoke suite signs in, then asserts that:

- the `/alerts` page renders (heading "Alert rules" plus its empty state), and
- the `/live-feed` page renders (heading "Live feed").

It deliberately avoids `/analytics`, which needs `NEYNAR_API_KEY` and `HUM_MODEL`.

To run it locally, have the Clerk dev/test keys present in the environment, then `npm run test:e2e:application`.

##### The `[E2E]` trigger (opt-in, master-only)

The authed application E2E suite does **not** run on pull requests, and does not run on most `master` pushes. It is **opt-in**: it runs only when the event is a push to `master` **and** the head (merge/squash) commit message contains the literal tag `[E2E]`. To exercise it, include `[E2E]` in the commit message you merge to `master`. When it runs, it runs offline before AWS credentials are configured, so a failure **blocks** the production deploy.

The convenient way to add the tag when wrapping up a PR is the `/merge-and-close-and-test` command, which mirrors `/merge-and-close` but injects `[E2E]` into the squash commit body so the resulting `master` deploy runs the authed suite.

##### Required CI secrets

The authed suite needs three GitHub Actions repository secrets, which **must be the Clerk dev/test instance** (a `pk_test…` / `sk_test…` pair — never the production Clerk instance):

- `CLERK_TEST_PUBLISHABLE_KEY` — a `pk_test…` value (mapped to env `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- `CLERK_TEST_SECRET_KEY` — a `sk_test…` value (mapped to env `CLERK_SECRET_KEY`).
- `CLERK_TEST_EMAIL` — a `+clerk_test@…` address.

The suite fails loudly if any of these is missing. CI also needs Chromium (already installed for the marketing suite via `npx playwright install --with-deps chromium`) and outbound network access to the Clerk API.

#### Installing the browser

Locally, run `npx playwright install chromium` once to get the browser — browsers are not committed to the repo. CI installs them with `npx playwright install --with-deps chromium`.

## What runs in CI

Every push to `master` and every pull request runs the core gate in `.github/workflows/deploy.yml`, in this order:

```
lint → typecheck → unit → integration → marketing E2E
```

All five steps must pass before the deploy proceeds, so they gate every deployment. They run **before** AWS credentials are configured and need no AWS access — the integration layer is in-memory (dynalite) and the marketing E2E layer targets the offline marketing app.

Additionally, on **`master` pushes whose commit message contains `[E2E]`**, the **authed application E2E** suite (`npm run test:e2e:application`) runs as well. It also runs offline and before AWS credentials are configured, so a failure likewise gates (blocks) the production deploy. It never runs on pull requests.

## Adding a test

**Unit tests.** Add a Vitest file next to the code it covers, in the relevant workspace. Any new pure logic — a calculation, parser, data transform, or DynamoDB key builder — ships with unit tests in the same change.

**Integration tests.** When you add or change a DynamoDB access pattern (a `keys.ts` builder, a new GSI query, or an index-maintaining upsert), add or extend an integration test in `packages/core` named `*.integration.test.ts` that does a real write → read round-trip, so the index and table shape are exercised end to end.

**E2E tests.** For the marketing site, add Playwright specs under `e2e/` (for example `e2e/marketing/<area>.spec.ts`). For the authed application app, add specs under `e2e/application/`. Keep assertions scoped to stable, env-independent pages and elements so the suites stay offline and deterministic.

## A note on the application (authed) app

The authenticated `application` app **is** covered by a committed E2E suite — the opt-in, offline `npm run test:e2e:application` suite described above, which uses dynalite for DynamoDB and [`@clerk/testing`](https://clerk.com/docs/testing/playwright/overview) test tokens for Clerk sign-in. Because it is master-only and opt-in via the `[E2E]` commit tag, day-to-day exploratory checks of authed UI flows are still commonly done through ad-hoc Playwright runs locally (same Clerk test-token recipe) rather than waiting on CI.
