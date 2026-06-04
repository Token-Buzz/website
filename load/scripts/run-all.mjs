/**
 * load/scripts/run-all.mjs
 *
 * Run every k6 load-test scenario in sequence (smoke → load → stress → spike),
 * giving each its own HTML/JSON report in load/reports/<scenario>.html|json.
 *
 * PREREQUISITES
 *   - k6 must be installed and on PATH: https://grafana.com/docs/k6/latest/set-up/install-k6/
 *   - Set BASE_URL before running (required by every scenario).
 *   - Set AUTH_TOKEN before running if you want app API routes exercised.
 *     The token must stay valid for the full sweep duration (~28 min for all
 *     four scenarios). A 1 h token (the default from mint-token.mjs) is plenty.
 *
 * USAGE (run from anywhere — the script resolves the repo root automatically)
 *   node load/scripts/run-all.mjs                  # all four scenarios
 *   node load/scripts/run-all.mjs smoke spike       # just those two, in order
 *
 * PowerShell example:
 *   $env:BASE_URL  = "https://pr-12.staging.tokenbuzz.app"
 *   $env:AUTH_TOKEN = $(node load/scripts/mint-token.mjs)
 *   node load/scripts/run-all.mjs
 *
 * This is a throwaway harness utility, not shipped application code.
 * It has zero npm dependencies — uses only Node built-ins.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCENARIOS = ["smoke", "load", "stress", "spike"];

/** Rough wall-clock minutes per scenario (used for time estimate only). */
const SCENARIO_MINUTES = { smoke: 1, load: 8, stress: 14, spike: 5.5 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** stderr-only print so k6's inherited stdout is not polluted. */
function err(...args) {
  process.stderr.write(args.join(" ") + "\n");
}

function formatMinutes(total) {
  if (total < 60) return `~${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Resolve repo root (this file lives at load/scripts/run-all.mjs → two up)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Parse CLI args — optional scenario subset
// ---------------------------------------------------------------------------

const requested = process.argv.slice(2);
let toRun;

if (requested.length === 0) {
  toRun = SCENARIOS;
} else {
  const invalid = requested.filter((s) => !SCENARIOS.includes(s));
  if (invalid.length > 0) {
    err(
      `\nERROR: Unknown scenario(s): ${invalid.join(", ")}\n` +
        `Valid scenarios: ${SCENARIOS.join(", ")}\n`
    );
    process.exit(1);
  }
  toRun = requested;
}

// ---------------------------------------------------------------------------
// Ensure reports directory exists
// ---------------------------------------------------------------------------

const reportsDir = resolve(repoRoot, "load", "reports");
mkdirSync(reportsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Pre-flight notice
// ---------------------------------------------------------------------------

const totalMinutes = toRun.reduce((sum, s) => sum + SCENARIO_MINUTES[s], 0);

err("\n========================================");
err("  k6 load-test sweep — run-all.mjs");
err("========================================");
err(`  Scenarios : ${toRun.join(" → ")}`);
err(`  Est. time : ${formatMinutes(totalMinutes)}`);
err(`  Reports   : ${reportsDir}`);
err("  k6 output is streamed to stdout live.");
err("");

if (!process.env.AUTH_TOKEN) {
  err(
    "  WARNING: AUTH_TOKEN is not set.\n" +
      "  Authed /api routes will be skipped (or will return 401).\n" +
      "  Set AUTH_TOKEN to a valid Clerk JWT before running if you need\n" +
      "  full application API coverage (see load/README.md)."
  );
  err("");
} else {
  err(
    "  NOTE: AUTH_TOKEN is set — ensure it stays valid for the full sweep\n" +
      `  (${formatMinutes(totalMinutes)}). A 1 h token from mint-token.mjs easily covers this.`
  );
  err("");
}

err("  Starting in 1 s …\n");
// Brief pause so the user can read the notice before k6 output floods in.
// (synchronous sleep via a tight spawnSync date trick avoids a dep)
const t0 = Date.now();
while (Date.now() - t0 < 1000) { /* spin */ }

// ---------------------------------------------------------------------------
// Run scenarios
// ---------------------------------------------------------------------------

/** Results collected as { name, exitCode, reportPath } */
const results = [];

for (const scenario of toRun) {
  const reportPath = `load/reports/${scenario}.html`;

  err(`\n----------------------------------------`);
  err(`  Running: ${scenario}`);
  err(`  Report : ${reportPath}`);
  err(`----------------------------------------\n`);

  const env = {
    ...process.env,
    REPORT_NAME: scenario,
  };

  const result = spawnSync(
    "k6",
    ["run", `load/scenarios/${scenario}.js`],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
      // On Windows, PATH resolution for k6/k6.exe requires shell:true.
      shell: process.platform === "win32",
    }
  );

  if (result.error) {
    if (result.error.code === "ENOENT") {
      err(
        "\nERROR: k6 not found on PATH.\n" +
          "Install it first: https://grafana.com/docs/k6/latest/set-up/install-k6/\n"
      );
      process.exit(1);
    }
    // Some other OS-level error — surface it and bail.
    err(`\nERROR: Failed to spawn k6 for scenario "${scenario}": ${result.error.message}\n`);
    process.exit(1);
  }

  // k6 exits non-zero when thresholds are breached — that's informative, not
  // fatal for the sweep. Record the result and continue with remaining scenarios.
  results.push({
    name: scenario,
    exitCode: result.status ?? 1,
    reportPath,
  });
}

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

err("\n========================================");
err("  Sweep complete — results");
err("========================================");

const COL_NAME = 8;
const COL_STATUS = 8;

err(
  `  ${"Scenario".padEnd(COL_NAME)}  ${"Result".padEnd(COL_STATUS)}  Report`
);
err(`  ${"--------".padEnd(COL_NAME)}  ${"------".padEnd(COL_STATUS)}  ------`);

let anyFailed = false;
for (const r of results) {
  const passed = r.exitCode === 0;
  const status = passed ? "PASS" : `FAIL (${r.exitCode})`;
  if (!passed) anyFailed = true;
  err(`  ${r.name.padEnd(COL_NAME)}  ${status.padEnd(COL_STATUS)}  ${r.reportPath}`);
}

err("");
if (anyFailed) {
  err(
    "  One or more scenarios breached thresholds (exit non-zero).\n" +
      "  Open each report above in a browser to inspect the details.\n"
  );
} else {
  err("  All scenarios passed their thresholds.\n");
}
err("========================================\n");

process.exit(anyFailed ? 1 : 0);
