/**
 * load/scenarios/load.js — Load test
 *
 * Simulates average expected traffic with a gentle ramp-up, steady state,
 * then ramp-down. Confirms the system handles sustained real-world load
 * without degrading latency or error rate.
 *
 * Approximate load:
 *   - Ramp: 1→10 VUs over 2 min
 *   - Steady: 10 VUs for 5 min
 *   - Ramp-down: 10→0 VUs over 1 min
 *   - Each VU: ~25 requests/iteration with 1 s sleep between each
 *   - Peak RPS ≈ 10 VUs × ~0.4 req/s ≈ 4 req/s (well under RPS_CAP of 20)
 *
 * GUARDRAIL: Always run against a pr-<N> stage, NEVER production.
 *            Peak RPS is intentionally kept low to protect free-tier quotas.
 *
 * Usage (from repo root):
 *   BASE_URL=https://pr-12.staging.tokenbuzz.app \
 *   AUTH_TOKEN=<clerk-session-jwt> \
 *   QUERY=bitcoin \
 *   k6 run load/scenarios/load.js
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
  // Ramping VU executor: gentle ramp-up → steady → ramp-down
  // Peak: 10 VUs — approx 4 req/s blended across marketing + app routes
  stages: [
    { duration: "2m", target: 10 }, // ramp up to 10 VUs over 2 min
    { duration: "5m", target: 10 }, // hold 10 VUs for 5 min (steady state)
    { duration: "1m", target: 0 },  // ramp down to 0 over 1 min
  ],

  thresholds,

  tags: { scenario: "load" },
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
      sleep(1); // 1 s between requests keeps per-VU RPS ≈ 1
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
      sleep(1); // 1 s between requests
    }
  });
}
