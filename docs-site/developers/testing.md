# Testing

TokenBuzz is an npm-workspaces monorepo (`packages/marketing`, `packages/application`, `packages/core`, `packages/jobs`, `packages/scripts`). All test commands run from the repo root.

Automated testing is organised as a pyramid of three layers — many fast unit tests at the base, fewer integration tests in the middle, and a thin end-to-end smoke layer on top:

- **Unit tests** — fast, pure-logic checks with no external dependencies.
- **Integration tests** — exercise the real DynamoDB data-access code against an in-memory database.
- **End-to-end (E2E) tests** — drive a real browser against the public marketing site.

All three layers gate CI and run without AWS credentials.

## Running the tests

| Layer | Command | What it covers | Needs |
|---|---|---|---|
| Unit | `npm run test:unit` | Pure logic: calculations, parsers, data transforms, DynamoDB key builders | Nothing (no SST stage, no AWS) |
| Integration | `npm run test:integration` | Real `packages/core/src/db` access patterns against in-memory DynamoDB | Nothing (fully offline via dynalite) |
| E2E | `npm run test:e2e` | Public marketing site smoke flows in a real browser | Chromium (`npx playwright install chromium` once) |

### Unit tests

Run with `npm run test:unit`. Powered by [Vitest](https://vitest.dev) (`vitest run`), with test files living alongside the code in each workspace. They cover pure logic — calculations, parsers, data transforms, and DynamoDB key builders — and require no SST stage and no AWS access. This is the fastest layer and the base of the pyramid.

### Integration tests

Run with `npm run test:integration`. These use Vitest plus **dynalite** (an in-memory DynamoDB) and live in `packages/core` as files named `*.integration.test.ts`, run via `vitest.integration.config.ts`.

Rather than testing pure helpers in isolation, they exercise the **real** `packages/core/src/db` functions — the actual `ddb` client, key builders, and GSI queries — against a local in-memory DynamoDB. This catches bugs unit tests can't, for example a write that omits a GSI key so the corresponding index query can never see it.

The suite runs fully offline (no AWS, no `sst shell`): the harness boots dynalite, recreates the `infra/db.ts` tables and GSIs, and points the production DynamoDB client at it purely via environment variables.

### End-to-end (E2E) tests

Run with `npm run test:e2e`. Powered by [Playwright](https://playwright.dev) driving Chromium. The config is the root `playwright.config.ts`; tests live under `e2e/` (for example `e2e/marketing/smoke.spec.ts`).

The E2E suite targets the **marketing** app only. Because the marketing app has no auth and no database, the suite runs fully offline: Playwright's `webServer` boots `next dev` on port 3000 and drives a real browser against it.

The current smoke suite covers:

- The homepage hero and primary CTA.
- The main navigation.
- The footer.
- Footer → contact navigation.
- The coming-soon page.

It deliberately avoids the `/changelog` page (which needs a GitHub token at request time) and does **not** submit the contact form (which needs Turnstile and Resend).

Locally, run `npx playwright install chromium` once to get the browser — browsers are not committed to the repo. CI installs them with `npx playwright install --with-deps chromium`.

## What runs in CI

Every push to `master` and every pull request runs the full gate in `.github/workflows/deploy.yml`, in this order:

```
lint → typecheck → unit → integration → E2E
```

All five steps must pass before the deploy proceeds, so they gate every deployment. They run **before** AWS credentials are configured and need no AWS access — the integration layer is in-memory (dynalite) and the E2E layer targets the offline marketing app.

## Adding a test

**Unit tests.** Add a Vitest file next to the code it covers, in the relevant workspace. Any new pure logic — a calculation, parser, data transform, or DynamoDB key builder — ships with unit tests in the same change.

**Integration tests.** When you add or change a DynamoDB access pattern (a `keys.ts` builder, a new GSI query, or an index-maintaining upsert), add or extend an integration test in `packages/core` named `*.integration.test.ts` that does a real write → read round-trip, so the index and table shape are exercised end to end.

**E2E tests.** Add Playwright specs under `e2e/` (for example `e2e/marketing/<area>.spec.ts`). Keep assertions scoped to stable, env-independent pages and elements so the suite stays offline and deterministic.

## A note on the application (authed) app

The committed E2E suite does **not** cover the authenticated `application` app, because exercising its UI needs Clerk authentication and DynamoDB. Authed UI flows are instead validated through ad-hoc Playwright runs combined with [`@clerk/testing`](https://clerk.com/docs/testing/playwright/overview) by developers — using Clerk's test tokens — rather than in CI.
