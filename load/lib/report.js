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
 *
 * Report filename stem defaults to "summary" (→ summary.html / summary.json).
 * Override with __ENV.REPORT_NAME to give each scenario its own file, e.g.:
 *   REPORT_NAME=smoke k6 run load/scenarios/smoke.js
 * The run-all runner sets REPORT_NAME=<scenario> automatically so each sweep
 * scenario writes to its own file instead of overwriting summary.html.
 * Any characters outside [a-zA-Z0-9_-] are replaced with underscores.
 */

import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const REPORT_DIR = (__ENV.REPORT_DIR || "load/reports").replace(/\/$/, "");
const REPORT_NAME = (__ENV.REPORT_NAME || "summary").replace(/[^a-zA-Z0-9_-]/g, "_");

/**
 * handleSummary(data)
 *
 * Called by k6 after the test run completes. Returns a map of
 * output-path → content that k6 writes to disk.
 *
 * Outputs:
 *   {REPORT_DIR}/{REPORT_NAME}.html  — visual HTML report (benc-uk/k6-reporter)
 *   {REPORT_DIR}/{REPORT_NAME}.json  — raw JSON metrics dump
 *   stdout                           — human-readable text summary
 */
export function handleSummary(data) {
  return {
    [`${REPORT_DIR}/${REPORT_NAME}.html`]: htmlReport(data),
    [`${REPORT_DIR}/${REPORT_NAME}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
