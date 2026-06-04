# Running Load Tests

All load tests target an ephemeral `pr-<N>` preview stage — never the production site. Complete steps follow.

---

## 1. Install k6

k6 is a standalone binary with no Node.js dependency. See the [full install guide](https://grafana.com/docs/k6/latest/set-up/install-k6/) for all platforms. Common one-liners:

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
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

---

## 2. Target a `pr-<N>` stage

Open a pull request against `master`. The GitHub Actions workflow automatically deploys an ephemeral stage named `pr-<number>`. The deployment URL is surfaced in the Actions run output and in the PR checks.

| Service | URL pattern |
|---|---|
| Marketing site | `https://pr-<N>.staging.tokenbuzz.app` |
| Application | `https://app.pr-<N>.staging.tokenbuzz.app` |

Set `BASE_URL` to the marketing URL. The harness auto-derives `APP_BASE_URL` by inserting `app.` after the protocol:

```bash
export BASE_URL=https://pr-12.staging.tokenbuzz.app
# APP_BASE_URL resolves to https://app.pr-12.staging.tokenbuzz.app automatically
```

Override `APP_BASE_URL` explicitly if your stage uses a different URL pattern.

---

## 3. Obtain an auth token

Without `AUTH_TOKEN`, only the four marketing pages are exercised. To include the ~22 application API routes, provide a Clerk JWT.

> **Security posture:** The `Authorization: Bearer` fallback is accepted **only on non-production stages** (`APP_STAGE !== "production"`). Production rejects it entirely — a leaked token cannot authenticate against the live site. Keep the token short-lived and never commit it.

### One-time setup — create the `loadtest` JWT template

In the **staging** Clerk Dashboard, go to **JWT Templates → New template**. Name it `loadtest`, choose **Blank**, keep the default claims (the `sub` claim must remain), and set **Token lifetime** to `3600` seconds (1 hour). This only needs to be done once per staging Clerk instance.

### Per-run — mint a fresh token

```bash
export AUTH_TOKEN=$(node load/scripts/mint-token.mjs)
```

The script reads `CLERK_SECRET_KEY` and `CLERK_TEST_EMAIL` from the environment, looks up the user, creates a session, and prints only the raw JWT to stdout. Re-mint at the start of each run — the script makes this trivial.

For exact token-minting steps, fallback options (if the Clerk Backend API session creation is unavailable), and cookie-based alternatives, refer to `load/README.md` in the repository.

### Token security checklist

- Keep `TTL` at 3600 seconds (the recommended maximum for load tests).
- Never commit `AUTH_TOKEN` to version control and keep it out of CI logs.
- Re-mint at the start of each run.
- The staging Clerk instance + `+clerk_test` user limits blast radius: the token is useless on production even if it leaks.

---

## 4. Run a scenario

All commands are run from the **repo root** so that relative paths resolve correctly.

### Run a single scenario

```bash
BASE_URL=https://pr-12.staging.tokenbuzz.app \
AUTH_TOKEN=<clerk-session-jwt> \
k6 run load/scenarios/smoke.js
```

Swap `smoke.js` for `load.js`, `stress.js`, or `spike.js` to run a different scenario. Each scenario writes its own HTML report to `load/reports/<scenario>.html`.

### Run the full sweep

`load/scripts/run-all.mjs` runs smoke → load → stress → spike in sequence and writes each report to its own file:

```bash
# Set env first
export BASE_URL=https://pr-12.staging.tokenbuzz.app
export AUTH_TOKEN=$(node load/scripts/mint-token.mjs)

# Run all four scenarios (~28 min total)
node load/scripts/run-all.mjs

# Or run a subset in order
node load/scripts/run-all.mjs smoke spike
```

The runner prints a pass/fail table at the end and exits non-zero if any scenario breached its thresholds.

**PowerShell (Windows):**
```powershell
$env:BASE_URL   = "https://pr-12.staging.tokenbuzz.app"
$env:AUTH_TOKEN = $(node load/scripts/mint-token.mjs)
node load/scripts/run-all.mjs
```

---

## 5. Reading the results

### Thresholds

k6 exits non-zero if any threshold is breached:

| Threshold | Value | Notes |
|---|---|---|
| `http_req_duration p(95)` | `< 2000 ms` | Blended across all requests. Spike test uses 4000 ms. |
| `http_req_failed rate` | `< 1%` | A `4xx` from missing auth is a config error, not a service error. |
| `checks rate` | `> 99%` | Per-request status-code assertions. |

### What a passing run looks like

- stdout shows green check marks next to all thresholds.
- `http_req_failed` stays under 1% throughout.
- p95 latency is within budget — marketing pages may spike briefly on a cold CloudFront edge, but drop sharply once the cache warms after the first few requests.
- The HTML report at `load/reports/<scenario>.html` shows a smooth latency curve with no sustained degradation.

### Transient errors during ramp-up

> **Note on cold-start errors:** A small, sparse error rate (e.g. ~0.3%) that appears only during the VU ramp-up phase on a freshly-deployed preview stage is typically **transient cold-start or DynamoDB on-demand warm-up throttling**, not a code regression. Check the failing requests' HTTP status to distinguish the cause:
>
> - `429` or `500` with a `ThrottlingException` body → DynamoDB on-demand table warming up; re-run after a minute.
> - `502` / `504` or a connection timeout → Lambda cold start; re-run after a minute.
> - A consistent failure rate that persists across the steady-state phase, or errors on specific routes reproducibly → investigate as a code or configuration regression.

A genuine code bug fails consistently across hundreds of requests, not 1-in-hundreds during ramp-up only.
