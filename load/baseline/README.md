# load/baseline — Baseline metrics

This directory holds captured baseline performance snapshots from real k6 runs
against a `pr-<N>` stage. **No numbers are fabricated here.**

## Why baselines matter

k6 thresholds in `config/thresholds.js` set an absolute pass/fail bar
(e.g. `p(95)<2000`). A baseline snapshot goes further: it gives you a
_reference point_ from a known-good run so you can detect gradual regressions
(latency creeping up over multiple PRs) that stay within the threshold but are
still noteworthy.

## How to capture a baseline

1. Deploy a clean `pr-<N>` stage with a representative data set ingested
   (at minimum: the `QUERY` token — default `bitcoin` — must have recent tweets
   ingested so the analytics/tweets routes return real data, not empty arrays).

2. Run the **load** scenario (sustained traffic, most representative):

   ```bash
   BASE_URL=https://pr-<N>.staging.tokenbuzz.app \
   AUTH_TOKEN=<clerk-session-jwt> \
   QUERY=bitcoin \
   REPORT_DIR=load/baseline \
   k6 run load/scenarios/load.js
   ```

   Setting `REPORT_DIR=load/baseline` writes the JSON output here instead of
   `load/reports/` (which is gitignored). The HTML report is also written here
   but is gitignored (too large to commit) — only the JSON is retained.

3. Rename the output for clarity:

   ```bash
   mv load/baseline/summary.json load/baseline/baseline-<YYYY-MM-DD>-pr-<N>.json
   ```

4. Commit the JSON file. Do NOT commit `summary.html` (it is large and binary-ish).

## What to capture in the JSON

Key metrics to note when reviewing a baseline JSON:

| Metric | Path in JSON |
|---|---|
| p95 request duration (overall) | `metrics.http_req_duration.values.p(95)` |
| p99 request duration | `metrics.http_req_duration.values.p(99)` |
| Error rate | `metrics.http_req_failed.values.rate` |
| Total requests | `metrics.http_reqs.values.count` |
| RPS | `metrics.http_reqs.values.rate` |
| Check pass rate | `metrics.checks.values.rate` |

## Gitignore note

`load/reports/` is gitignored (generated per-run, not for committing).
`load/baseline/*.json` baseline snapshots ARE committed (intentionally captured).
`load/baseline/*.html` HTML reports are gitignored even in this directory
(add `!load/baseline/*.json` to override the `load/reports/` ignore pattern
if needed — the current `.gitignore` entry is `load/reports/` so baseline/
is unaffected).

## Current baselines

_No baselines captured yet. Run the load scenario against a `pr-<N>` stage and
commit the resulting JSON to establish the initial baseline._
