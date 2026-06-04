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

## Appendix — test inventory (file-by-file)

A map of what each test file covers, grouped by layer. The `describe`/`test` titles in each file are the source of truth for exact behaviour; this list is a navigational aid and will drift as suites grow, so treat counts as approximate.

### Unit tests (`npm run test:unit`) — pure logic, no DB or network

Run by each workspace's `test:unit` script (Vitest). External services (DynamoDB client, Twitter/Reddit/KMS, …) are mocked; files live beside the code as `*.test.ts` (the config excludes `*.integration.test.ts`).

**DynamoDB key builders** (`packages/core/src/db/`) — assert the exact `pk`/`sk`/GSI string format and key-space disjointness so the single-table design stays consistent:

- `db/conversation-keys.test.ts` — conversation + message key format and disjoint prefixes.
- `db/feed-keys.test.ts` — token-profile, feed-item, feed/guid/source GSIs, watchlist-by-symbol GSI.
- `db/notification-prefs-key.test.ts` — notification-prefs key format.
- `db/rate-limit.test.ts` — rate-limit key, retry-after seconds, near-limit threshold, EMF metric shape.
- `db/saved-query-keys.test.ts` — saved-query key format.
- `db/stripe-keys.test.ts` — Stripe event + customer key format.
- `db/usage-keys.test.ts` — plan + usage key format.

**External data adapters** (`packages/core/src/lib/`) — map each provider's API response to the internal `RawTweet`, plus error/retry/pagination handling:

- `lib/twitter.test.ts` · `lib/reddit.test.ts` · `lib/discord.test.ts` · `lib/telegram.test.ts` · `lib/farcaster.test.ts` — per-provider mappers, typed API errors, retry on 5xx/network (no retry on 4xx), pagination, rate-limit/`Retry-After` handling; Reddit/Telegram also cover BYOK credential encode/decode/validate.

**Billing & subscriptions** (`packages/core/src/billing/`):

- `billing/stripe.test.ts` — status mapping (active/past_due/trialing), price-ID lookup, dunning detection, grace window, effective-plan logic.
- `billing/tiers.test.ts` — free/pro/alpha limits, quota evaluation (ingestion/HUM/refresh), plan rank, history TTL, billing period.

**Analytics, price & movers** (`packages/core/src/`):

- `movers.test.ts` — buzz-delta percent change, no-prior sentinel, zero-volume edge; rolling 1H/24H window ranges.
- `ticker.test.ts` — derive price + 24h delta from candle bars (empty/short/zero-prior edges).
- `live-feed.test.ts` — merge paginated feeds newest-first with limit + cursor composition.
- `social-events.test.ts` — volume/sentiment spike detection (sigma outliers, min-sample guard), KOL-handle check, event builders.
- `providers.test.ts`, `providers/geckoterminal.test.ts`, `providers/jupiter.test.ts`, `providers/price.test.ts` — provider registry + price-source adapters.

**Queries & ingestion** (`packages/core/src/lib/`, `sources/`):

- `lib/queryId.test.ts` — query-ID encode/decode round-trip + hash validation.
- `lib/recent-queries.test.ts` — dedup keeping most recent, limit, order.
- `lib/poll-assignment.test.ts` — assign queries to BYOK holders (case-insensitive dedup, first-holder-wins).
- `lib/group-queries.test.ts` — Today/Yesterday/This-week/Older bucketing.
- `sources/ingestion-mode.test.ts`, `sources/registry.test.ts`, `sources/apify-adapter.test.ts` — ingestion-mode resolution, source registry, Apify adapter.

**Alerting & crypto** (`packages/core/src/`):

- `alerts-eval.test.ts` — rule evaluation for mention_spike / price_move / sentiment_swing, threshold boundaries, cooldown.
- `lib/crypto.test.ts` — KMS encrypt/decrypt of secrets (mocked KMS).

**Application UI logic** (`packages/application/app/`):

- `_dashboard/humTime.test.ts` — relative-time formatting; `_dashboard/commandRegistry.test.ts` — pick-by-id ordering; `_dashboard/humContext.test.ts` — Hum context build/serialize; plus `_dashboard/brief`, `candleChart`, `narratives`, `todayData`, `commandSwatch`, and `_analytics/concurrencyGate` dashboard/analytics helpers.
- `dashboards/_components/grid.test.ts`, `scope.test.ts`, `cardActions.test.ts` — grid layout save/restore, scope filtering, card actions.
- `_auth/postAuthDest.test.ts`, `_auth/redirectDest.test.ts` — post-sign-in destination + redirect rules.
- `api/webhooks/stripe/_email.test.ts` — alert email URL/subject building; `api/hum/chat/_models.test.ts` — Hum model selection.

**Jobs / scripts / marketing:**

- `packages/jobs/src/alert-email.test.ts`, `alert-evaluator.test.ts` — alert email building + evaluation job.
- `packages/scripts/src/stamp.test.ts`, `release-notes.test.ts` — cycle-time stamp + release-notes generation.
- `packages/marketing/app/_components/tickerFormat.test.ts` — ticker symbol formatting.

### Integration tests (`npm run test:integration`) — real DynamoDB code against dynalite

Vitest with `packages/core/vitest.integration.config.ts`: a `globalSetup` boots in-memory **dynalite**, recreates the `infra/db.ts` tables + GSIs, and the real `packages/core/src/db` functions run actual write→read round-trips. Catches index/table-shape bugs unit tests can't. All files are `packages/core/test/*.integration.test.ts`:

- `account.integration.test.ts` — export/delete all user data, ciphertext redaction.
- `billing.integration.test.ts` — Stripe event idempotency, customer↔user index, subscription→plan writes, grace/downgrade.
- `monitors.integration.test.ts`, `monitor-poll.integration.test.ts`, `monitor-poll-apify.integration.test.ts` — monitor CRUD + poll-state transitions (incl. Apify).
- `alerts.integration.test.ts` — alert-rule CRUD + trigger records.
- `saved-queries.integration.test.ts`, `saved-queries-list.integration.test.ts`, `saved-query-retention.integration.test.ts` — saved-query CRUD, list pagination, per-plan TTL.
- `dashboards.integration.test.ts`, `watchlist-entries.integration.test.ts` — dashboard layouts + watchlist entries.
- `feeds.integration.test.ts`, `live-feed.integration.test.ts`, `social-events.integration.test.ts` — feed-item storage + GSI queries, live-feed pagination, social-event ingestion.
- `source-counts.integration.test.ts`, `pulse-series.integration.test.ts`, `spike-pipeline.integration.test.ts` — source mention counts, rolling pulse series, end-to-end spike detection.
- `byok.integration.test.ts`, `byok-poll.integration.test.ts` — encrypted per-user BYOK credential storage + poll state.
- `conversations.integration.test.ts` — Hum conversation/message storage + `updatedAt`-DESC ordering.
- `ingestion-mode.integration.test.ts`, `poll-state.integration.test.ts`, `ohlcv.integration.test.ts`, `usage.integration.test.ts`, `token-ref.integration.test.ts`, `notification-prefs.integration.test.ts` — ingestion-mode state, poll-state TTL, candle history, usage-quota tracking, token-alias resolution, notification preferences.

### Marketing E2E (`npm run test:e2e`) — `e2e/marketing/smoke.spec.ts`

Playwright + Chromium against `next dev` (:3000), offline:

1. Homepage hero + primary CTA (links to `#pricing`).
2. Top navigation renders (Features / Pricing / Changelog links).
3. Footer present with copyright.
4. Footer "Contact" → `/contact` ("Get in touch").
5. `/coming-soon` renders its heading.

### Authed application E2E (`npm run test:e2e:application`) — `e2e/application/smoke.spec.ts`

`global-setup.ts` boots dynalite + recreates tables, runs `clerkSetup()`, and creates the `CLERK_TEST_EMAIL` user via the Clerk Backend API; each test injects a Clerk testing token and signs in headlessly (email-code OTP `424242` for the `+clerk_test` address) against `next dev` (:3002):

1. `/alerts` renders the "Alert rules" heading + "No alert rules yet" empty state.
2. `/live-feed` renders the "Live feed" heading.

### Not run in CI

`npm test -w packages/core` runs Vitest under `sst shell` (needs a live AWS stage / `Resource` bindings) — for local checks that require real SST resources. CI uses the offline dynalite path instead so it stays reproducible and AWS-free.
