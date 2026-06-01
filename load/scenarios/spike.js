/**
 * load/scenarios/spike.js — Spike test
 *
 * Simulates a sudden burst of traffic (e.g. a viral tweet or a scheduled
 * announcement) followed by recovery back to baseline. Validates that the
 * system survives the burst and returns to healthy latency afterward.
 *
 * Approximate load:
 *   - Baseline: 5 VUs for 1 min
 *   - Spike: 5→50 VUs in 30 s, hold 1 min
 *   - Recovery: 50→5 VUs in 30 s, hold 2 min
 *   - Ramp down: 5→0 VUs in 30 s
 *   - Each VU: ~25 requests/iteration with 1 s sleep
 *   - Peak RPS ≈ 50 VUs × ~0.4 req/s ≈ 20 req/s (at the RPS_CAP ceiling)
 *   - Total duration: ~5.5 min
 *
 * The spike is intentionally short (1 min at peak) so Lambda concurrency
 * autoscaling has time to catch up. If the system shows elevated latency
 * for more than 30 s after recovery, that is worth investigating.
 *
 * GUARDRAIL: Always run against a pr-<N> stage, NEVER production.
 *            50 VU spike is the hard cap — do not raise it. All targeted
 *            routes are DynamoDB reads / CloudFront cache hits; no upstream
 *            fan-out to paid APIs occurs at these endpoints.
 *
 * Usage (from repo root):
 *   BASE_URL=https://pr-12.staging.tokenbuzz.app \
 *   AUTH_TOKEN=<clerk-session-jwt> \
 *   QUERY=bitcoin \
 *   k6 run load/scenarios/spike.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";

import {
  thresholds,
  MARKETING_ROUTES,
  APP_ROUTES,
  marketingUrl,
  appUrl,
  authHeaders,
  hasAuth,
} from "../config/thresholds.js";
import { handleSummary } from "../lib/report.js";

export { handleSummary };

// Spike thresholds are slightly relaxed vs the steady-state load test:
// the p95 budget is higher to account for the burst ramp and Lambda cold
// starts during the spike. Tighten once a baseline has been captured.
const spikeThresholds = {
  ...thresholds,
  // Override only p95 — errors must still be <1%
  http_req_duration: ["p(95)<4000"], // burst allowance: 4 s during spike
};

export const options = {
  stages: [
    { duration: "1m", target: 5 },   // baseline
    { duration: "30s", target: 50 }, // sudden spike — Lambda autoscales here
    { duration: "1m", target: 50 },  // hold spike — observe behavior
    { duration: "30s", target: 5 },  // recovery begins
    { duration: "2m", target: 5 },   // confirm recovery (latency returns to baseline)
    { duration: "30s", target: 0 },  // ramp down
  ],

  thresholds: spikeThresholds,

  tags: { scenario: "spike" },
};

export default function () {
  // ── Marketing pages ─────────────────────────────────────────────────────
  group("marketing", function () {
    for (const path of MARKETING_ROUTES) {
      const res = http.get(marketingUrl(path), {
        tags: { name: `marketing${path}`, group: "marketing" },
      });
      check(res, {
        [`marketing ${path} → 200`]: (r) => r.status === 200,
      });
      sleep(1);
    }
  });

  // ── Application API routes ───────────────────────────────────────────────
  if (!hasAuth) {
    return;
  }

  group("app_api", function () {
    const headers = authHeaders();

    for (const route of APP_ROUTES) {
      const res = http.get(appUrl(route.path), {
        headers,
        tags: { name: route.name, group: "app_api" },
      });
      check(res, {
        [`${route.name} → 2xx`]: (r) => r.status >= 200 && r.status < 300,
      });
      sleep(1);
    }
  });
}
