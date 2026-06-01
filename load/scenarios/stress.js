/**
 * load/scenarios/stress.js — Stress test
 *
 * Pushes VU count past the expected steady-state level to find the
 * "knee" — the point where latency degrades or errors appear. Uses a
 * step-ramp to make the knee visible in the HTML report.
 *
 * Approximate load:
 *   - Stages: 0→5→10→20→30 VUs, then ramp down
 *   - Each VU: ~25 requests/iteration with 1 s sleep between each
 *   - Peak RPS ≈ 30 VUs × ~0.4 req/s ≈ 12 req/s (under RPS_CAP of 20)
 *   - Total duration: ~14 min
 *
 * The thresholds are intentionally the same as the load test so that
 * regressions discovered at stress load also fail the run (exit non-zero).
 * If the system degrades gracefully above ~15 VUs, that is useful data —
 * record the inflection point and lower the steady threshold in load.js.
 *
 * GUARDRAIL: Always run against a pr-<N> stage, NEVER production.
 *            Capped at 30 VUs to stay within $0 free-tier quotas.
 *
 * Usage (from repo root):
 *   BASE_URL=https://pr-12.staging.tokenbuzz.app \
 *   AUTH_TOKEN=<clerk-session-jwt> \
 *   QUERY=bitcoin \
 *   k6 run load/scenarios/stress.js
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

export const options = {
  // Step ramp: each stage is short enough to observe latency changes
  // before the next step. 30 VUs is the ceiling — do not raise without
  // re-checking upstream quotas (Neynar, GeckoTerminal, Bedrock).
  stages: [
    { duration: "2m", target: 5 },  // low baseline
    { duration: "2m", target: 10 }, // expected steady state
    { duration: "2m", target: 20 }, // above normal
    { duration: "3m", target: 30 }, // stress ceiling — find the knee here
    { duration: "2m", target: 10 }, // partial recovery to confirm rebound
    { duration: "1m", target: 0 },  // ramp down
  ],

  thresholds,

  tags: { scenario: "stress" },
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
