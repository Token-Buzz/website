# M16 — Performance Tuning & Observability

Measure, observe, and tune the performance of both Next.js apps and the background jobs, end-to-end, using a **zero-cost** toolchain: **k6** (self-run from a local machine), **Lighthouse CI** (GitHub Actions, free temporary-public-storage), and **AWS CloudWatch + X-Ray** (kept inside the always-free tier via sampling). The goal is a repeatable way to find the slow paths — frontend (Core Web Vitals, bundle size) and backend (Lambda cold starts, slow DynamoDB GSI queries) — fix them, and prove the improvement with before/after numbers.

This milestone is **measurement + tuning**, not new product features. It builds on the existing `infra/monitoring.ts` (EMF metrics + the GeckoTerminal rate-limit alarm) rather than introducing a parallel stack.

## Locked decisions

- **Total cost = $0.** Nothing in this milestone may incur recurring spend.
  - **k6 is always self-run** from a local machine (the free, open-source CLI). **No k6 Cloud / Grafana Cloud k6** — results stay local (a generated HTML/JSON report), optionally committed as a baseline. No load-testing SaaS.
  - **Lighthouse CI** runs in **GitHub Actions** (already-paid CI minutes) and uploads reports to **free `temporary-public-storage`** — no self-hosted LHCI server, no S3 bucket.
  - **X-Ray** stays inside the **100,000-traces/month always-free tier** via an explicit low-rate **sampling rule**. **CloudWatch** stays inside the free tier (≤3 dashboards, ≤10 alarms, ≤5 GB logs).
- **k6 targets an ephemeral `pr-<N>` stage**, never production. This exercises the real Lambda + CloudFront + DynamoDB path while isolating real users. Because `/api/query` fans out to shared free-tier upstreams (Neynar, GeckoTerminal, per-user twitterapi.io), load scenarios **cap RPS/duration and prefer cacheable / already-ingested read paths** so a load run can't blow an upstream quota. The runbook documents how to bring a `pr-<N>` stage up and tear it down.
- **Lighthouse CI is advisory first, a hard gate later.** Initially LHCI runs on PRs and surfaces the report **without failing the build**; once baselines/budgets are stable (end of Phase 4) the assertions tighten to `error` so regressions block merge.
- **X-Ray = active tracing on all Lambdas, sampled.** Active tracing is enabled on the marketing server fn, the application server fn, and the jobs/cron fns via SST `transform`, governed by a single low-rate `aws.xray.SamplingRule` so monthly traces stay free.
- **No product/UX behavior changes in Phases 1–3.** They are pure instrumentation + tooling. Only **Phase 4** changes app code, and every change is justified by a measured before/after.
- **Tuning is evidence-driven.** A change ships only with a number behind it (a Web Vital, a p95 latency, a bundle-size delta, a cold-start count) — no speculative "this feels faster" edits.

## Config / infra additions

```ts
// infra/monitoring.ts — extend the EXISTING module (do not add a new Router/stack):
//   • aws.xray.SamplingRule — one low fixed-rate rule (e.g. reservoir 1/s + 5% rate)
//     so total monthly traces stay under the 100k free-tier limit.
//   • aws.cloudwatch.Dashboard — "website-<stage>-performance":
//       Lambda  Duration p50/p95/p99, Errors, Throttles, ConcurrentExecutions, cold starts
//       DynamoDB ConsumedRead/WriteCapacity + ThrottledRequests per table
//       CloudFront Requests, 4xx/5xx rate, OriginLatency
//   • aws.cloudwatch.MetricAlarm — p95 server-fn latency + 5xx error-rate alarms
//     (production-only, gated on isProd, alongside the existing rate-limit alarm).

// infra/marketing.ts, infra/application.ts, infra/jobs.ts — enable X-Ray active
// tracing on the server/cron functions via the SST `transform` hook. No new secrets.

// No DynamoDB schema changes: no new table, keys, or GSI in this milestone.
// No new sst.Secret entries.
```

```
// New top-level `load/` directory (self-run k6, committed; NOT a workspace dep):
load/
  README.md            # how to install k6 + run each scenario against a pr-<N> stage
  config/thresholds.js # shared p95/error-rate thresholds + BASE_URL/env handling
  scenarios/
    smoke.js           # 1 VU, ~1 min — sanity that endpoints respond under load tooling
    load.js            # average expected traffic, ramping VUs
    stress.js          # push past expected load to find the breaking point
    spike.js           # sudden burst then recovery
  lib/report.js        # handleSummary → local HTML + JSON report (k6-reporter)

// New CI workflow:
.github/workflows/lighthouse.yml   # build marketing, run lhci autorun, upload temp-public-storage
lighthouserc.json                  # URLs + budgets/assertions (warn-only at first)
```

## Phases

### Phase 1 — Observability foundation: X-Ray + CloudWatch dashboard (M)

- Enable **X-Ray active tracing** on the marketing, application, and jobs Lambdas via SST `transform`; add one `aws.xray.SamplingRule` tuned to stay inside the 100k-traces free tier.
- Extend `infra/monitoring.ts` with a **CloudWatch dashboard** (`website-<stage>-performance`) covering Lambda latency percentiles / errors / cold starts, DynamoDB consumed capacity + throttles per table, and CloudFront request/error/origin-latency.
- Add **p95-latency** and **5xx-error-rate** `MetricAlarm`s (production-only, `isProd`-gated), consistent with the existing rate-limit alarm.
- Verify on a `pr-<N>` stage: traces appear in the X-Ray console, the dashboard renders, sampling keeps trace volume low.
- **Deliverable:** committed infra + a short note in the runbook on how to open the dashboard and read a trace.

### Phase 2 — k6 load-testing harness, self-run, $0 (L)

- Stand up the `load/` directory: shared thresholds/config (`BASE_URL` from env), and the four scenarios (smoke / load / stress / spike) with **p95-latency + error-rate `thresholds`** so a run exits non-zero on regression.
- Target the **marketing apex** (static + contact API) and **selected application API routes**; respect the guardrails — cap RPS/duration and prefer cacheable / already-ingested read paths so upstream free-tier quotas (Neynar/GeckoTerminal/BYOK) aren't exhausted. Document how authed routes are exercised (Clerk testing token / a `+clerk_test` session) where needed.
- `handleSummary` writes a **local HTML + JSON report**; commit an initial baseline report (or its summary numbers) for comparison.
- `load/README.md`: install k6, bring up a `pr-<N>` stage, set `BASE_URL`, run each scenario, read the report, tear the stage down.
- **Deliverable:** anyone can clone, install k6, and run a load test against a `pr-<N>` stage with one command per scenario.

### Phase 3 — Lighthouse CI on PRs (M)

- Add `.github/workflows/lighthouse.yml`: build `packages/marketing`, run `lhci autorun` against the home, `/changelog`, `/contact`, and `/coming-soon` routes (plus key authed app pages if feasible behind a Clerk testing token), upload to **temporary-public-storage**.
- `lighthouserc.json`: budgets/assertions for performance, accessibility, best-practices, SEO + key Core Web Vitals (LCP, CLS, TBT). **`warn`-only initially** (advisory), with a clear path to flip to `error` (hard gate) in Phase 4.
- Post the report link on the PR (action default) so regressions are visible per-PR.
- **Deliverable:** every PR gets an automatic Lighthouse report; budgets are defined but non-blocking.

### Phase 4 — Analysis & tuning (L)

Act on the evidence from Phases 1–3. Each change ships with a measured before/after.

- **Frontend:** `@next/bundle-analyzer` pass → code-split / trim heavy client bundles; `next/image` + dimensions to kill CLS; font loading (`next/font`, preload/`display:swap`); cache-control / CDN headers on static + cacheable routes; defer non-critical JS. Re-measure with Lighthouse.
- **Backend:** use X-Ray traces + the dashboard to find cold-start-heavy and slow-GSI paths; reduce server-fn bundle size, tighten DynamoDB query projections / use the right GSI, batch where possible. Re-measure p95 with k6.
- **Tighten the gates:** once budgets hold, flip the impactful Lighthouse assertions from `warn` to `error` so regressions block merge.
- **Deliverable:** a before/after table (Web Vitals, p95 latency, bundle size, cold starts) showing the wins; LHCI now gating.

### Phase 5 — Docs + performance runbook (S)

- A `docs/` perf runbook: how to run k6 against a `pr-<N>` stage, how to open and read the CloudWatch dashboard and an X-Ray trace, how to read a Lighthouse report, and the **recorded baselines/budgets** (the numbers Phase 4 is measured against).
- Keep this milestone doc + the epic issue Status section current as phases land.
- **Deliverable:** a single runbook a fresh session can follow to reproduce every measurement.

## Dependencies & ordering

- **Phase 1 → Phase 4 (backend):** X-Ray/dashboard must exist before backend tuning has evidence.
- **Phase 2 → Phase 4 (backend):** k6 baselines must exist to prove p95 wins.
- **Phase 3 → Phase 4 (frontend):** Lighthouse baselines must exist to prove Web-Vital wins, and to know which assertions are safe to flip to `error`.
- **Phases 1, 2, 3 are independent of each other** and can run in parallel.

## Risks & guardrails

- **Upstream free-tier quota burn (highest risk).** Load tests that hit `/api/query` fan out to Neynar / GeckoTerminal / per-user twitterapi.io. Mitigation: cap RPS + duration, prefer cacheable / already-ingested read paths, run only against a `pr-<N>` stage, and watch the existing rate-limit alarm during a run.
- **X-Ray / CloudWatch creeping out of the free tier.** Mitigation: a single low-rate sampling rule, ≤3 dashboards, ≤10 alarms; spot-check the AWS Billing free-tier usage page after enabling.
- **GitHub Actions minutes (private repo).** LHCI runs are short; if minutes get tight, scope LHCI to PRs touching `packages/marketing`.
- **Tuning regressions.** Every Phase-4 change is behind a measured before/after and the normal lint/typecheck/unit/integration gates; no behavior-changing edit ships without a number.

## Status / Next steps / Gotchas

- **Status:** spec authored; epic + phase issues being created. No code yet.
- **Next:** Phase 1 (X-Ray + dashboard) and Phase 3 (Lighthouse CI) are the cheapest independent starts; Phase 2 (k6) needs a live `pr-<N>` stage to target.
- **Gotchas:** keep everything inside AWS free tier (sampling!); never point k6 at production; LHCI stays advisory until Phase 4.
