/**
 * load/lib/report.js
 *
 * handleSummary — writes HTML + JSON reports and prints text to stdout.
 * Import this in every scenario and re-export handleSummary.
 *
 * k6 resolves https imports from its own module cache at runtime.
 * These are NOT Node modules and are NOT evaluated during npm lint/typecheck.
 *
 * Run k6 from the repo root so relative paths resolve correctly:
 *   k6 run load/scenarios/smoke.js
 *
 * Report output directory defaults to load/reports/ (added to .gitignore).
 * Override with __ENV.REPORT_DIR, e.g.:
 *   REPORT_DIR=/tmp/k6 k6 run load/scenarios/smoke.js
 */

import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const REPORT_DIR = (__ENV.REPORT_DIR || "load/reports").replace(/\/$/, "");

/**
 * handleSummary(data)
 *
 * Called by k6 after the test run completes. Returns a map of
 * output-path → content that k6 writes to disk.
 *
 * Outputs:
 *   {REPORT_DIR}/summary.html  — visual HTML report (benc-uk/k6-reporter)
 *   {REPORT_DIR}/summary.json  — raw JSON metrics dump
 *   stdout                     — human-readable text summary
 */
export function handleSummary(data) {
  return {
    [`${REPORT_DIR}/summary.html`]: htmlReport(data),
    [`${REPORT_DIR}/summary.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
