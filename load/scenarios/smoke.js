/**
 * load/scenarios/smoke.js — Smoke test
 *
 * 1 VU, ~1 minute. Sanity check: confirms every targeted route returns a
 * successful status code before running heavier scenarios.
 *
 * Approximate load:
 *   - 1 VU × (4 marketing + up to 21 app routes) × ~2 s/req + sleep
 *   - Peak RPS ≈ 1–2 req/s — well within $0 guardrail
 *
 * GUARDRAIL: Always run against a pr-<N> stage, NEVER production.
 *
 * Usage (from repo root):
 *   BASE_URL=https://pr-12.staging.tokenbuzz.app \
 *   AUTH_TOKEN=<clerk-session-jwt> \
 *   QUERY=bitcoin \
 *   k6 run load/scenarios/smoke.js
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

// Re-export handleSummary so k6 picks it up from this entry file
export { handleSummary };

export const options = {
  // 1 VU for the full duration — just a sanity pass
  vus: 1,
  duration: "1m",

  thresholds,

  // Tag all requests with the scenario name for easy filtering in the report
  tags: { scenario: "smoke" },
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
      sleep(1); // 1 s between requests — keeps RPS ≈ 1
    }
  });

  // ── Application API routes ───────────────────────────────────────────────
  if (!hasAuth) {
    // AUTH_TOKEN not provided — skip app routes, log once per iteration
    // (k6 console output is deduplicated per iteration in most terminals)
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
