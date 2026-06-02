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

**Preferred for load tests — long-lived JWT template token:**

Create a **JWT template** in the Clerk dashboard (Clerk Dashboard → JWT
Templates → New template). Set the **Token lifetime** to a long value (up to
315360000 s = 10 years). Then mint a token for the `+clerk_test` user via the
Clerk Backend API or the dashboard's "Generate token" button, and export it:

```bash
export AUTH_TOKEN=<long-lived-jwt>
```

The application's `requireUserId()` helper accepts this token on `pr-<N>` and
non-production stages by verifying it directly with `verifyToken` (Clerk SDK)
using the instance secret key. **Production rejects this path entirely** — the
load-test JWT fallback is gated to `APP_STAGE !== "production"` at runtime,
so a misconfigured token cannot authenticate against the live site.

The JWT template setting lives under **Clerk Dashboard → JWT Templates**.
Choose "Blank" and set the lifetime; no custom claims are required.

**Option A — `@clerk/testing` (recommended, headless, short-lived):**

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

**Option B — copy from browser:**

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
