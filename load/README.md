# Token Buzz — k6 Load-Testing Harness

Self-contained, **$0 cost** load-testing harness using the open-source
[k6](https://k6.io) CLI. Scenarios run against ephemeral `pr-<N>` stages
**only** — never production.

---

## Contents

```
load/
  README.md                  ← you are here
  config/thresholds.js       ← shared config: BASE_URL, auth, routes, thresholds
  scenarios/
    smoke.js                 ← 1 VU, ~1 min: sanity pass
    load.js                  ← ramping to 10 VUs, ~8 min: sustained load
    stress.js                ← ramp to 30 VUs, ~12 min: find the knee
    spike.js                 ← sudden burst to 50 VUs then recovery, ~5.5 min
  lib/report.js              ← handleSummary → HTML + JSON report + stdout
  baseline/README.md         ← how to capture and commit baseline snapshots
  reports/                   ← gitignored (generated per run)
```

---

## Test catalogue — what each scenario does

The harness ships the four standard load-test archetypes (the same categories
[k6's own docs](https://grafana.com/docs/k6/latest/testing-guides/test-types/)
define). They all hit the **same** routes (the four marketing pages + the app
API routes) and assert the **same** thresholds — they differ only in the
*shape* of traffic they apply.

| Scenario | Traffic shape | Duration | Answers… |
|---|---|---|---|
| `smoke` | 1 user, flat | ~1 min | "Does every route work at all?" |
| `load` | ramp to 10 users, hold | ~8 min | "Is it healthy under normal traffic?" |
| `stress` | step-ramp to 30 users | ~12 min | "Where does it start to degrade?" |
| `spike` | sudden burst to 50 users | ~5.5 min | "Does it survive a surge and recover?" |

### `smoke` — sanity check
- **Profile:** 1 virtual user (VU), constant, ~1 minute.
- **Purpose:** confirm every targeted route returns a success status before
  bothering with heavier runs. The fastest, cheapest gate.
- **Pass:** every route `2xx`, 0 failed requests. If smoke fails, fix that
  before running anything else.
- **When:** first, always — and as a quick post-deploy confirmation.

### `load` — sustained normal traffic
- **Profile:** ramp 1→10 VUs over 2 min, hold 10 VUs for 5 min, ramp down.
- **Purpose:** simulate average expected traffic and confirm latency and error
  rate stay within budget under sustained use.
- **Pass:** p95 latency under threshold, error rate < 1%, checks > 99% across
  the run — especially during the 5-minute steady state.
- **When:** to validate that a release behaves under realistic everyday load.

### `stress` — find the breaking point
- **Profile:** step-ramp 5→10→20→30 VUs, partial recovery, ramp down.
- **Purpose:** push past normal load to find the "knee" — the point where
  latency degrades or errors appear. The steps make the inflection visible in
  the report.
- **Pass:** uses the **same thresholds as `load` on purpose**, so a regression
  that only appears under stress still fails the run. Graceful degradation high
  up is useful data — note the VU count where it turns and feed it back into
  the thresholds.
- **When:** to learn capacity/headroom, e.g. before a marketing push.

### `spike` — sudden surge + recovery
- **Profile:** baseline 5 VUs, jump to 50 VUs in 30 s, hold 1 min, drop back,
  confirm recovery over 2 min.
- **Purpose:** model a viral moment or scheduled announcement and verify the
  system survives the burst **and** returns to healthy latency afterward (giving
  Lambda concurrency time to autoscale).
- **Pass:** survives the burst within the looser spike latency allowance, and
  latency returns to baseline within ~30 s of recovery. Sustained elevation
  after the spike is the thing to investigate.
- **When:** to validate burst resilience.

**Common to all four:** they run against a `pr-<N>` stage only — never
production; they are capped (≤ 50 VUs / ≤ 20 RPS) to stay within $0 free-tier
quotas; and they hit DynamoDB-backed reads / CloudFront cache hits, with no
fan-out to paid upstream APIs.

> These are **performance** tests, run on-demand against a deployed stage. They
> are intentionally separate from the functional tests that gate CI on every
> push (`npm run test:unit`, `npm run test:integration`).

---

## Sizing & cost — how to choose a VU count

A **VU (virtual user)** is one simulated user — an independent worker that loops
through the requests. More VUs = more simultaneous load. The right number is the
one that matches the traffic you actually need to survive — **not** an arbitrary
large number. Two tests at the same VU count can also produce very different load:
what matters downstream is **requests/second (RPS)**, not raw VU count. These
scripts sleep ~1 s between requests, so here **1 VU ≈ 1 RPS**.

### Choosing the number

1. **Measure real peak load, then multiply.** Target = (observed peak RPS) × a
   **2–5× safety margin**. Size to the *peak* hour, not the daily average —
   traffic is bursty and peak is often 2–5× the mean hour.
2. **Before you have traffic, estimate from a goal.** Pick a target (e.g. "5,000
   daily active users"), then apply a heuristic: **peak concurrent ≈ 5–10 % of
   daily active users**, and a browsing user generates ~0.1–1 RPS. 5,000 DAU →
   ~250–500 concurrent → a few hundred RPS → test around 500–1,000 VUs with
   margin. Re-baseline against real numbers as soon as you have traffic.
3. **This harness is capped at 50 VUs / ~20 RPS on purpose** — enough to confirm
   the read paths are healthy while staying $0 on free-tier. Raise it only when
   real traffic data justifies it.

### Where to get real traffic numbers

- **CloudWatch (already collecting, free):** the ground truth. Watch Lambda
  **`ConcurrentExecutions`** (peak) and Lambda/CloudFront **request count per
  minute** — that *is* your load, directly replicable as RPS.
- **A web-analytics tool** (Plausible / Cloudflare Web Analytics / Vercel
  Analytics): sessions, concurrent visitors, page views.

### When to scale up (and the cost)

VUs cost memory/CPU on the machine running k6 (~a few MB each):

- **Up to a few thousand VUs** — fine on one decent machine (or your laptop).
- **10k–100k VUs** — needs **distributed load generation** (a fleet of load
  generators, or a commercial service like Grafana Cloud k6). On one machine you
  saturate the *generator* first and end up measuring the test rig, not the app.

There are **two** cost buckets: running k6, and the AWS bill from the traffic it
generates (Lambda + DynamoDB + CloudFront). Rough order-of-magnitude for this
stack, ~$5–8 per **million** requests to the authed API routes (Lambda-dominated;
marketing pages are mostly CloudFront-cached and near-free). Assuming ~1 RPS/VU
over a 10-minute run:

| Test | ≈ RPS | Requests (10 min) | Load-gen cost | AWS cost | Also needs |
|---|---|---|---|---|---|
| **500 VUs** | ~500 | ~300k | ~$0 (laptop / one small VM) | **~$1–3** | nothing — runs as-is |
| **100k VUs** | ~100k | ~60M | **$10–50/hr** fleet, or a commercial k6 plan | **~$250–500 per run** | raising the AWS Lambda concurrency limit ~100× (default ≈1,000) |

These are order-of-magnitude estimates (real cost varies with response size,
per-route DynamoDB reads, and Lambda duration/memory). The takeaway: **500 VUs is
a couple of dollars and runs today; 100k VUs is hundreds of dollars per run plus a
real engineering setup** — only justified at genuine consumer scale.

---

## 1. Install k6

k6 is a standalone binary — no Node.js dependency.

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Windows (winget):**
```bash
winget install k6 --source winget
```

**Docker:**
```bash
docker pull grafana/k6
```

Full install docs: https://grafana.com/docs/k6/latest/set-up/install-k6/

---

## 2. Spin up a `pr-<N>` stage

Open a pull request against `master`. The GitHub Actions workflow
(`.github/workflows/deploy.yml`) automatically deploys an ephemeral stage
named `pr-<number>`.

**Host pattern (from `infra/marketing.ts` and `infra/application.ts`):**

| Service | URL pattern |
|---|---|
| Marketing site | `https://pr-<N>.<WEB_DOMAIN>` |
| Application | `https://app.pr-<N>.<WEB_DOMAIN>` |

Where `WEB_DOMAIN` is the staging domain (e.g. `staging.tokenbuzz.app`), so:

- Marketing: `https://pr-12.staging.tokenbuzz.app`
- Application: `https://app.pr-12.staging.tokenbuzz.app`

The deployment URL is surfaced in the GitHub Actions run output and in the
PR checks. Both use **DNS-only (grey cloud) Cloudflare records** so ACM can
issue the certificate directly.

---

## 3. Set environment variables

### Required

```bash
export BASE_URL=https://pr-12.staging.tokenbuzz.app
```

The harness auto-derives `APP_BASE_URL` by inserting `app.` after the
protocol: `https://app.pr-12.staging.tokenbuzz.app`. Override with
`APP_BASE_URL=...` if your stage uses a different pattern.

### Optional — auth token (for application API routes)

Without `AUTH_TOKEN`, only the four marketing pages are exercised. To include
the application API routes, provide a Clerk auth token.

App API routes need a token that outlives Clerk's ~60 s session token. However,
**a long-lived JWT is a non-revocable bearer credential** — Clerk JWTs cannot
be individually revoked; the only revocation lever is rotating the instance's
signing keys, which invalidates every token at once. The correct posture is to
**mint a short-lived (~1 h) token per run** rather than keeping a static
long-lived one. **Do not use a 10-year token.**

#### One-time setup — JWT template (staging Clerk dashboard)

1. Open the **staging** Clerk Dashboard → **JWT Templates** → **New template**.
2. Name it `loadtest`, choose **Blank**, keep the default claims (the `sub`
   claim must remain — it carries the user id).
3. Set **Token lifetime** to `3600` seconds (1 hour).

This only needs to be done once per staging instance.

#### Per-run — mint a fresh token

```bash
export AUTH_TOKEN=$(node load/scripts/mint-token.mjs)
# then run your k6 scenario as usual:
k6 run load/scenarios/smoke.js
```

The script (`load/scripts/mint-token.mjs`) reads these env vars — the two
required ones are already present in Claude Code web sessions:

| Env var | Default | Purpose |
|---|---|---|
| `CLERK_SECRET_KEY` | _(required)_ | Staging instance secret key (`sk_test_…`) |
| `CLERK_TEST_EMAIL` | _(required)_ | `+clerk_test@…` address to mint for |
| `CLERK_JWT_TEMPLATE` | `loadtest` | JWT template name |
| `TOKEN_TTL_SECONDS` | `3600` | Token lifetime passed to `getToken` |

The script looks up the user by email, calls the Clerk Backend API to create a
session, calls `getToken` with the template + TTL, and **prints only the raw
JWT to stdout** — nothing else — so the `$()` capture works cleanly. All
diagnostics go to stderr.

#### Security note

The token only authenticates on non-production stages. The `requireUserId()`
helper accepts the `Authorization: Bearer` fallback **solely when
`APP_STAGE !== "production"`** — production rejects it entirely, so a leaked
token cannot authenticate against the live site. Because a Clerk JWT cannot be
revoked once issued:

- Keep `TTL` short (the default 3600 s is the recommended maximum for load tests).
- **Never commit `AUTH_TOKEN`** to version control and keep it out of CI logs.
- Re-mint at the start of each run — the script makes this trivial.
- The combination of the staging Clerk instance and the `+clerk_test` user
  limits blast radius: the token is useless on production even if it leaks.

---

#### Fallbacks (if Backend session creation is unavailable)

Use these if `mint-token.mjs` exits with a 403/forbidden error (e.g. your
staging Clerk plan disallows Backend API session creation). Note that both
options produce short-lived session tokens that **may expire mid-run** for
longer load scenarios.

**Option A — `@clerk/testing` (headless, short-lived):**

Install ad hoc (do not commit):
```bash
npm i -D playwright @clerk/testing && npx playwright install chromium
```

Then use Clerk's testing helpers with the `+clerk_test` user (OTP `424242`
is handled internally — no real inbox needed):

```javascript
import { clerkSetup } from "@clerk/testing/playwright";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
// clerkSetup() → setupClerkTestingToken({ page }) → extract __session cookie
```

See `CLAUDE.md` section "Local UI / browser testing" for the full pattern.

**Option B — copy from browser (short-lived):**

1. Sign in to the app at `https://app.pr-<N>.staging.tokenbuzz.app`.
2. Open DevTools → Application → Cookies → copy the `__session` value.
3. Pass it as a Bearer token: `AUTH_TOKEN=<value>` — the harness sends
   `Authorization: Bearer <AUTH_TOKEN>` on all app API requests.

**Cookie alternative (if the app only accepts the cookie, not the header):**

k6 supports `jar`-based cookies. Wrap the request:
```javascript
const jar = http.cookieJar();
jar.set(APP_BASE_URL, "__session", AUTH_TOKEN);
const res = http.get(appUrl(route.path), { headers, jar });
```

In practice the Next.js API routes check the Clerk middleware which reads
either the `Authorization: Bearer` header or the `__session` cookie — the
Bearer form used here is the standard approach for API testing.

### Optional — query token

```bash
export QUERY=bitcoin   # default; must be ingested in the pr-<N> stage
```

Routes like `/api/tweets?query=bitcoin` and all analytics endpoints use this
value. The pr-<N> stage must have the query ingested (via the TweetPoller or
a manual `/api/query` POST **before** the load test) for responses to contain
data. Empty-array 200s are still valid load test results — they exercise the
DynamoDB read path and auth layer.

---

## 4. Run a scenario

All commands are run from the **repo root** so that relative paths in
`lib/report.js` resolve to `load/reports/`.

### Smoke (sanity, ~1 min)
```bash
BASE_URL=https://pr-12.staging.tokenbuzz.app \
AUTH_TOKEN=<clerk-session-jwt> \
QUERY=bitcoin \
k6 run load/scenarios/smoke.js
```

### Load (sustained, ~8 min)
```bash
BASE_URL=https://pr-12.staging.tokenbuzz.app \
AUTH_TOKEN=<clerk-session-jwt> \
QUERY=bitcoin \
k6 run load/scenarios/load.js
```

### Stress (find the knee, ~12 min)
```bash
BASE_URL=https://pr-12.staging.tokenbuzz.app \
AUTH_TOKEN=<clerk-session-jwt> \
QUERY=bitcoin \
k6 run load/scenarios/stress.js
```

### Spike (burst + recovery, ~5.5 min)
```bash
BASE_URL=https://pr-12.staging.tokenbuzz.app \
AUTH_TOKEN=<clerk-session-jwt> \
QUERY=bitcoin \
k6 run load/scenarios/spike.js
```

### Run all scenarios in sequence

`load/scripts/run-all.mjs` runs smoke → load → stress → spike in order (or a
subset you specify) and writes each scenario's report to its own file in
`load/reports/`. k6 must be installed separately (see section 1 above).

**bash / macOS / Linux:**
```bash
# set AUTH_TOKEN + BASE_URL first (see section 3 above), then:
node load/scripts/run-all.mjs                    # smoke → load → stress → spike (~28 min)
node load/scripts/run-all.mjs smoke spike         # just those two, in that order
```

**PowerShell (Windows):**
```powershell
$env:BASE_URL   = "https://pr-12.staging.tokenbuzz.app"
$env:AUTH_TOKEN = $(node load/scripts/mint-token.mjs)
node load/scripts/run-all.mjs                    # all four scenarios
node load/scripts/run-all.mjs smoke spike         # subset
```

Each scenario writes its own report: `load/reports/smoke.html`,
`load/reports/load.html`, etc. (instead of all overwriting `summary.html`).
The runner prints a pass/fail table at the end and exits 1 if any scenario
breached its thresholds, making it suitable for CI gating.

**With Docker:**
```bash
docker run --rm -i \
  -e BASE_URL=https://pr-12.staging.tokenbuzz.app \
  -e AUTH_TOKEN=<clerk-session-jwt> \
  -v "$(pwd)/load:/load" \
  grafana/k6 run /load/scenarios/smoke.js
```

---

## 5. Reports

After each run, k6 writes:

| File | Description |
|---|---|
| `load/reports/summary.html` | Visual HTML report (benc-uk/k6-reporter). Open in a browser. |
| `load/reports/summary.json` | Raw JSON metrics. Useful for diffing against baseline. |
| stdout | Human-readable text summary with thresholds pass/fail. |

Override the output directory:
```bash
REPORT_DIR=/tmp/k6-out k6 run load/scenarios/load.js
```

### Thresholds and exit code

k6 exits **non-zero** if any threshold is breached:

| Threshold | Value | Notes |
|---|---|---|
| `http_req_duration p(95)` | `<2000 ms` | Blended across all requests. Spike test uses 4000 ms. |
| `http_req_failed rate` | `<1%` | A 4xx from missing auth is a config error, not a service error. |
| `checks rate` | `>99%` | Per-request status-code assertions. |

Thresholds are defined as named constants in `config/thresholds.js` and are
easy to tune per environment. Marketing pages on a cold CloudFront edge can
exceed 3 s on the first request — the blended 2 s budget accounts for this
by measuring _across_ all request types. After the cache warms (a few
requests), marketing page latency drops sharply.

### Capturing a baseline

See `load/baseline/README.md`. Baselines are committed to version control
so regressions are detectable across PRs.

---

## 6. Routes exercised

### Marketing (public, no auth)

| Route | Notes |
|---|---|
| `GET /` | Homepage |
| `GET /changelog` | GitHub Releases feed (server-rendered) |
| `GET /contact` | Contact form page (page only, not the POST API) |
| `GET /coming-soon` | Landing page |

### Application API (auth required, DynamoDB read-only)

| Route | Notes |
|---|---|
| `GET /api/analytics/summary?query=<Q>` | |
| `GET /api/analytics/kpis?query=<Q>` | |
| `GET /api/analytics/sentiment?query=<Q>` | |
| `GET /api/analytics/hashtags?query=<Q>` | |
| `GET /api/analytics/keywords?query=<Q>` | |
| `GET /api/analytics/mentions?query=<Q>` | |
| `GET /api/analytics/engagement-timeseries?query=<Q>` | |
| `GET /api/analytics/spikes?query=<Q>` | |
| `GET /api/tweets?query=<Q>` | |
| `GET /api/live-feed?limit=50` | |
| `GET /api/movers?window=24h&limit=20` | |
| `GET /api/watchlist` | |
| `GET /api/dashboards` | |
| `GET /api/alerts` | |
| `GET /api/monitors` | |
| `GET /api/account/usage` | |
| `GET /api/query/quota` | |
| `GET /api/hum/quota` | |
| `GET /api/billing/plan` | |
| `GET /api/history/list` | |
| `GET /api/dashboard/today` | |
| `GET /api/dashboard/narratives` | |

### Deliberately excluded (and why)

| Route | Reason |
|---|---|
| `POST /api/contact` | Requires Cloudflare Turnstile token — always 4xx without it. |
| `POST /api/query` | Fans out to twitterapi.io (paid quota) + Neynar. |
| `GET /api/hum/chat` | Fans out to AWS Bedrock (billed per token). |
| `GET /api/hum/brief` | Fans out to AWS Bedrock (billed per token). |
| `GET /api/price/*` | Fans out to GeckoTerminal (rate-limited free tier). |
| Any `POST` / `DELETE` | State-modifying — not safe to hammer at load. |

---

## 7. Guardrails

**Never point at production.** The harness throws an error if `BASE_URL`
is not set. Always use a `pr-<N>` URL. If in doubt, confirm the URL starts
with `pr-` before running.

**VU caps:**

| Scenario | Peak VUs | Approx peak RPS |
|---|---|---|
| smoke | 1 | ~1 |
| load | 10 | ~4 |
| stress | 30 | ~12 |
| spike | 50 | ~20 (= RPS_CAP) |

**Watch the GeckoTerminal rate-limit alarm** during a stress or spike run.
Even though `/api/price/*` is excluded, a concurrent real user hitting those
routes during the test could push GeckoTerminal over quota. Check CloudWatch
alarms before and after each run.

**CloudFront cache-policy quota:** Each SST `pr-<N>` stage creates a new
CloudFront distribution and cache policy. AWS enforces a per-account limit
on cache policies. If the deploy fails with a cache-policy-quota error,
remove stale `pr-<N>` stages: `npx sst remove --stage pr-<N>`.

**Tear down after testing:**
```bash
npx sst remove --stage pr-<N>
```

This is important both to stay within the CloudFront cache-policy quota and
to avoid incurring any AWS charges on a long-running ephemeral stage.
