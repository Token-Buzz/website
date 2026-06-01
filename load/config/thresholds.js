/**
 * load/config/thresholds.js
 *
 * Shared configuration for all k6 load-test scenarios.
 * This is a k6 script (Goja runtime) — NOT a Node module.
 * https imports are resolved by k6 at runtime; they are correct here.
 *
 * GUARDRAIL: These scripts are designed for pr-<N> ephemeral stages ONLY.
 *            Never point BASE_URL at production (tokenbuzz.app).
 */

// ── Environment resolution ────────────────────────────────────────────────

/**
 * BASE_URL: root of the marketing site on the pr-<N> stage.
 *   e.g. https://pr-12.staging.tokenbuzz.app
 * Required — the harness throws if absent so runs never silently hit nothing.
 */
const BASE_URL = (() => {
  const url = __ENV.BASE_URL;
  if (!url) {
    throw new Error(
      "[k6 config] BASE_URL is required. " +
        "Set it to the pr-<N> marketing URL, e.g.:\n" +
        "  BASE_URL=https://pr-12.staging.tokenbuzz.app k6 run load/scenarios/smoke.js"
    );
  }
  // Strip trailing slash for consistent path joining
  return url.replace(/\/$/, "");
})();

/**
 * APP_BASE_URL: root of the application on the pr-<N> stage.
 *   e.g. https://app.pr-12.staging.tokenbuzz.app
 * Derived automatically from BASE_URL by inserting "app." after the protocol,
 * but can be overridden explicitly with __ENV.APP_BASE_URL if your stage uses
 * a different pattern.
 *
 * Pattern from infra/application.ts:
 *   domain: `app.${$app.stage}.${webDomain.value}`
 * Pattern from infra/marketing.ts:
 *   domain: `${$app.stage}.${webDomain.value}`
 *
 * So for pr-12.staging.tokenbuzz.app the app URL is app.pr-12.staging.tokenbuzz.app
 */
const APP_BASE_URL = (() => {
  if (__ENV.APP_BASE_URL) return __ENV.APP_BASE_URL.replace(/\/$/, "");
  // Insert "app." after the protocol prefix
  return BASE_URL.replace(/^(https?:\/\/)/, "$1app.");
})();

/**
 * AUTH_TOKEN: Clerk session JWT (Bearer token).
 * If absent, application API routes are skipped — only marketing pages run.
 * See README.md for how to obtain this token.
 */
const AUTH_TOKEN = __ENV.AUTH_TOKEN || null;

if (!AUTH_TOKEN) {
  console.log(
    "[k6 config] AUTH_TOKEN not set — application API routes will be SKIPPED. " +
      "Only marketing pages will be exercised.\n" +
      "  To include app routes, set AUTH_TOKEN to a Clerk session JWT:\n" +
      "  AUTH_TOKEN=<jwt> BASE_URL=... k6 run load/scenarios/smoke.js"
  );
}

/**
 * QUERY: token/keyword used for ?query= params (e.g. /api/tweets?query=bitcoin).
 * The pr-<N> stage must have this query already ingested for the response to
 * contain data — otherwise routes return 200 with empty arrays, which is still
 * a valid load test (it exercises the DB + auth path).
 */
const QUERY = __ENV.QUERY || "bitcoin";

// ── Request helpers ───────────────────────────────────────────────────────

/** Full URL for a marketing-site path. */
export function marketingUrl(path) {
  return `${BASE_URL}${path}`;
}

/** Full URL for an application-site path. */
export function appUrl(path) {
  return `${APP_BASE_URL}${path}`;
}

/**
 * Auth headers for application API calls.
 * Returns an empty object if no AUTH_TOKEN — callers must skip app routes.
 */
export function authHeaders() {
  if (!AUTH_TOKEN) return {};
  return { Authorization: `Bearer ${AUTH_TOKEN}` };
}

/** True when an AUTH_TOKEN is available and app routes should run. */
export const hasAuth = !!AUTH_TOKEN;

// ── RPS cap ───────────────────────────────────────────────────────────────

/**
 * RPS_CAP: conservative cap on requests-per-second across all VUs.
 * Kept low to avoid exhausting free-tier upstream quotas (Neynar, Bedrock,
 * GeckoTerminal). The cacheable/already-ingested read paths targeted here
 * are DynamoDB reads + CloudFront cache hits, but we stay well under any
 * per-minute API limits.
 *
 * Actual RPS in each scenario is determined by VU count + sleep() delays;
 * this constant is documented for reference and used in scenario comments.
 */
export const RPS_CAP = 20; // max target RPS across all VUs combined

// ── Route lists ───────────────────────────────────────────────────────────

/**
 * MARKETING_ROUTES: public pages on the marketing site (no auth needed).
 * POST /api/contact is deliberately excluded — it requires a Cloudflare
 * Turnstile token and would return 4xx without it.
 */
export const MARKETING_ROUTES = ["/", "/changelog", "/contact", "/coming-soon"];

/**
 * APP_ROUTES: application API routes targeted for load testing.
 * All are GET, read-only, DynamoDB-backed, and do NOT fan out to upstream
 * paid APIs (Neynar, GeckoTerminal, Bedrock, twitterapi.io).
 *
 * Deliberately excluded (and why):
 *   /api/query             — fans out to twitterapi.io (paid), hits Neynar
 *   /api/hum/chat          — fans out to Bedrock (billed per token)
 *   /api/hum/brief         — fans out to Bedrock
 *   /api/price/*           — fans out to GeckoTerminal (rate-limited)
 *   Any POST / DELETE      — state-modifying, not safe to hammer
 */
export const APP_ROUTES = [
  // Analytics routes — all read DynamoDB Aggregates table
  { path: `/api/analytics/summary?query=${QUERY}`, name: "analytics_summary" },
  { path: `/api/analytics/kpis?query=${QUERY}`, name: "analytics_kpis" },
  { path: `/api/analytics/sentiment?query=${QUERY}`, name: "analytics_sentiment" },
  { path: `/api/analytics/hashtags?query=${QUERY}`, name: "analytics_hashtags" },
  { path: `/api/analytics/keywords?query=${QUERY}`, name: "analytics_keywords" },
  { path: `/api/analytics/mentions?query=${QUERY}`, name: "analytics_mentions" },
  {
    path: `/api/analytics/engagement-timeseries?query=${QUERY}`,
    name: "analytics_engagement_ts",
  },
  { path: `/api/analytics/spikes?query=${QUERY}`, name: "analytics_spikes" },

  // Tweets / feed — reads Tweets table
  { path: `/api/tweets?query=${QUERY}`, name: "tweets" },
  { path: "/api/live-feed?limit=50", name: "live_feed" },

  // Movers — reads Aggregates/Tokens table
  { path: "/api/movers?window=24h&limit=20", name: "movers" },

  // User / account routes — reads UserData table
  { path: "/api/watchlist", name: "watchlist" },
  { path: "/api/dashboards", name: "dashboards" },
  { path: "/api/alerts", name: "alerts" },
  { path: "/api/monitors", name: "monitors" },
  { path: "/api/account/usage", name: "account_usage" },
  { path: "/api/query/quota", name: "query_quota" },
  { path: "/api/hum/quota", name: "hum_quota" },
  { path: "/api/billing/plan", name: "billing_plan" },
  { path: "/api/history/list", name: "history_list" },
  { path: "/api/dashboard/today", name: "dashboard_today" },
  { path: "/api/dashboard/narratives", name: "dashboard_narratives" },
];

// ── Thresholds ────────────────────────────────────────────────────────────

/**
 * P95 latency budgets (ms). Tune these per environment:
 *
 * - MARKETING_P95_MS: Marketing pages can be higher on first request because
 *   CloudFront warms the cache lazily per edge PoP. After a few requests
 *   the cache hit rate climbs and latency drops sharply. Set conservatively.
 *
 * - APP_API_P95_MS: Application API routes are Lambda + DynamoDB reads.
 *   DynamoDB single-digit-ms + Lambda cold start (~200ms) + CloudFront
 *   = budget ~800ms. Tighten after establishing a baseline.
 *
 * - OVERALL_P95_MS: Blended budget across all request types.
 */
const MARKETING_P95_MS = 3000; // generous for CloudFront cold edge warm-up
const APP_API_P95_MS = 800;
const OVERALL_P95_MS = 2000; // blended; tighten once baseline is captured

/**
 * Shared k6 thresholds object.
 * Import this and spread it into each scenario's `export const options`.
 *
 * http_req_duration: p95 over ALL requests combined.
 *   Per-group latency is visible in the HTML report (lib/report.js).
 *
 * http_req_failed: error rate must stay below 1%.
 *   A 4xx from an app route due to missing auth is a test-config problem,
 *   not a service regression — make sure AUTH_TOKEN is set correctly.
 *
 * checks: at least 99% of check() assertions must pass.
 */
export const thresholds = {
  http_req_duration: [`p(95)<${OVERALL_P95_MS}`],
  http_req_failed: ["rate<0.01"],
  checks: ["rate>0.99"],
};

// Re-export env values so scenarios don't need to re-read __ENV
export { BASE_URL, APP_BASE_URL, AUTH_TOKEN, QUERY };
