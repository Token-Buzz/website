# Load & Performance Testing

TokenBuzz validates performance with a self-contained, **$0 cost** k6 load-testing harness that lives in the repository under `load/`. All scenarios run against ephemeral `pr-<N>` preview stages **only — never production**.

> **Performance vs. functional tests:** These are on-demand performance tests, deliberately separate from the functional tests that gate CI on every push (`npm run test:unit`, `npm run test:integration`). They measure latency, throughput, and error rate under load — not correctness.

---

## Test catalogue

The harness ships the four standard load-test archetypes. All four hit the same routes and assert the same thresholds — they differ only in the shape of traffic they apply.

| Scenario | Traffic shape | Duration | Answers… |
|---|---|---|---|
| `smoke` | 1 user, flat | ~1 min | "Does every route work at all?" |
| `load` | ramp to 10 users, hold | ~8 min | "Is it healthy under normal traffic?" |
| `stress` | step-ramp to 30 users | ~12 min | "Where does it start to degrade?" |
| `spike` | sudden burst to 50 users | ~5.5 min | "Does it survive a surge and recover?" |

### `smoke` — sanity check

- **Profile:** 1 virtual user (VU), constant, ~1 minute.
- **Purpose:** confirm every targeted route returns a success status before running heavier scenarios. The fastest, cheapest gate.
- **Pass:** every route returns `2xx`, 0 failed requests. If smoke fails, fix the underlying issue before running anything else.
- **When to run:** first, always — and as a quick post-deploy confirmation on a new preview stage.

### `load` — sustained normal traffic

- **Profile:** ramp 1→10 VUs over 2 minutes, hold 10 VUs for 5 minutes, ramp down.
- **Purpose:** simulate average expected traffic and confirm that latency and error rate stay within budget under sustained use.
- **Pass:** p95 latency under threshold, error rate < 1%, checks > 99% across the run — especially during the 5-minute steady state.
- **When to run:** to validate that a release behaves correctly under realistic everyday load.

### `stress` — find the breaking point

- **Profile:** step-ramp 5→10→20→30 VUs, partial recovery, ramp down.
- **Purpose:** push past normal load to find the "knee" — the point where latency degrades or errors appear. The step structure makes the inflection point visible in the HTML report.
- **Pass:** uses the same thresholds as `load` on purpose, so a regression that only appears under stress still fails the run. Graceful degradation high up in the step range is useful capacity data — note the VU count where behaviour turns and feed it back into the thresholds.
- **When to run:** to understand capacity headroom, e.g. before a marketing push or a major feature launch.

### `spike` — sudden surge + recovery

- **Profile:** baseline 5 VUs, jump to 50 VUs in 30 seconds, hold for 1 minute, drop back, confirm recovery over 2 minutes.
- **Purpose:** model a viral moment or scheduled announcement and verify the system survives the burst **and** returns to healthy latency afterward (allowing Lambda concurrency time to autoscale).
- **Pass:** survives the burst within the looser spike latency allowance, and latency returns to baseline within ~30 seconds of recovery. Sustained elevation after the spike drops is the thing to investigate.
- **When to run:** to validate burst resilience before a high-traffic event.

---

## What's exercised

The harness covers **4 marketing pages** (public, no auth) and **~22 read-only application API routes** (Clerk-authenticated, DynamoDB-backed).

### Marketing pages (public, no auth required)

| Route | Notes |
|---|---|
| `GET /` | Homepage |
| `GET /changelog` | GitHub Releases feed (server-rendered) |
| `GET /contact` | Contact form page (page load only, not the POST handler) |
| `GET /coming-soon` | Landing page |

### Application API routes (auth required, DynamoDB read-only)

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

### Deliberately excluded routes

| Route | Reason |
|---|---|
| `POST /api/contact` | Requires a Cloudflare Turnstile token — always `4xx` without one. |
| `POST /api/query` | Fans out to twitterapi.io (paid quota) and Neynar. |
| `GET /api/hum/chat` | Fans out to AWS Bedrock (billed per token). |
| `GET /api/hum/brief` | Fans out to AWS Bedrock (billed per token). |
| `GET /api/price/*` | Fans out to GeckoTerminal (rate-limited free tier). |
| Any `POST` / `DELETE` | State-modifying — not safe to exercise at load. |

---

## Guardrails

- **Capped at ≤ 50 VUs / ≤ 20 RPS** across all scenarios — enough to validate the read paths while staying within $0 free-tier quotas.
- All exercised routes are **DynamoDB reads or CloudFront cache hits** with no fan-out to paid upstream APIs.
- The harness throws an error if `BASE_URL` is not set, and the auth token is accepted only on non-production stages — production rejects it entirely.
- Tear down preview stages when done (`npx sst remove --stage pr-<N>`) to avoid CloudFront cache-policy quota exhaustion and residual AWS charges.
