# Session handoff — TokenBuzz

## TL;DR for the next session
- **Repo:** `Token-Buzz/website` (npm-workspaces monorepo, SST v4 on AWS).
- **Active branch:** `claude/aws-testing-dynamodb-E5haH` — 3 commits, pushed, **PR not opened**. Adds a dynalite integration-test layer + CI gate + CLAUDE.md docs (details below).
- **Immediate next task:** migrate ClickUp milestones → **GitHub Projects**. Blocked this session because `gh` / the GitHub API isn't reachable in the web environment. The user is installing `gh` ahead of the next session. Full plan + ClickUp IDs + prerequisites under "NEXT TASK" below.

## ⚠️ This handoff lives on branch `claude/aws-testing-dynamodb-E5haH`
A fresh session started from `master` will NOT see this file (or the test layer) unless the branch is merged first. Either merge `claude/aws-testing-dynamodb-E5haH` to `master`, or start the next session on that branch.

## What this session did — verify the movers fix against a real DynamoDB
The merged movers fix (PR #16) had never been verified against real DynamoDB. The web shell has only **read-only** AWS, `sst shell` doesn't work here (needs `CLOUDFLARE_API_TOKEN` + blocked network), and the user works from mobile — so the durable answer was an offline, CI-able integration layer rather than hand-testing or live-prod reads.

Built a **dynalite (in-memory DynamoDB) integration-test layer** in `packages/core`:
- `test/spike-pipeline.integration.test.ts` — 5 scenarios driving the REAL `sumPulse → computeBuzzDelta → updateTokenBuzz → getSpikingTokens/listTrackedTokens` path the spike-materializer composes. Scenario 1 is the direct regression test for the original bug (a write missing `gsi1pk='SPIKE'` is invisible to the SpikingByDelta GSI query).
- Harness (`test/dynalite-global.ts`, `test/integration-env.ts`, `test/dynalite.d.ts`): boots dynalite, recreates the `infra/db.ts` tables + GSIs, and points production `client.ts` at it via **env vars only** (`AWS_ENDPOINT_URL_DYNAMODB` + `SST_RESOURCE_*`). `client.ts` is NOT modified.
- `vitest.config.ts` (unit; excludes `*.integration.test.ts`) + `vitest.integration.config.ts` (includes them; wires globalSetup + setupFiles).
- Scripts: `test:integration` in `packages/core` + a root aggregator. Wired into `.github/workflows/deploy.yml` as a deploy gate (after "Unit tests", before AWS creds — dynalite needs no AWS).
- CLAUDE.md documents all of it.
- Commits: `901ac16` (tests), `64c7585` (CI gate), `ed5b739` (docs). Verified locally: `test:integration` 5/5, `test:unit` 6/6, root lint + typecheck clean.

### Live AWS facts (read-only `claude-readonly` user)
- **production**: Tweets 11.7k, Aggregates 36k (incl. **6,307 `PULSE#<sym>` rows** for the 6 default symbols), **Tokens empty**, UserData empty.
- **pr-16 stage**: 6 tokens (all `dbuzz=0`), no tweets/aggregates.
- **Poller is stale**: latest `PULSE#$SOL` bucket was `2026-05-22T21:26` (>1 day old). The materializer's 2-hour window finds nothing → no live spikes right now even after the fix deployed. Upstream poller appears stopped — worth checking (separate issue). Live-prod verification is the user's own manual step.

## NEXT TASK — migrate ClickUp milestones → GitHub Projects

### Why it was blocked this session
The web environment exposes GitHub only via the **MCP server** (`mcp__github__*`) + a **local git proxy** (`http://local_proxy@127.0.0.1:.../git/...`). No `gh`, no GitHub token in env, `curl https://api.github.com` → **403**. MCP tools can create Issues + sub-issues and assign EXISTING milestones, but CANNOT create native **Milestones** or create/populate a **Projects v2 board** (no project tools, no GraphQL access).

### gh prerequisites the next session must verify
The user is installing `gh` ahead of time. Before doing migration work, confirm all three:
1. **gh binary present:** `gh --version`.
2. **Network allows GitHub:** `gh auth status` and `curl -s -o /dev/null -w '%{http_code}' https://api.github.com` should NOT be 403. If 403, the environment's network policy still blocks `github.com` / `api.github.com` — the user must pick a more permissive policy when creating the environment (see https://code.claude.com/docs/en/claude-code-on-the-web).
3. **Token + scopes:** `GH_TOKEN` set to a PAT with `repo`, `read:org`, `project` (Projects v2 is org-owned under `Token-Buzz`). Verify with `gh project list --owner Token-Buzz`.

### ClickUp source data (already discovered — reuse, don't re-crawl unless it changed)
- Space `tokenbuzz.app` (id `90145593462`), list id **`901416380123`**.
- **9 milestones:** M1 Movers/Live feed/Alerts (`86ba31jna`), M2 Watchlists→Dashboards (`86ba31jnf`), M3 Hum AI slide-out (`86ba31jp2`), M4 Top nav + ⌘K (`86ba31jpx`), M5 Account/Billing/Stripe (`86ba31jq9`), M6 Candlestick + Price Charts (`86ba31jqq`), M7 Marketing live ticker (`86ba31jr3`), M8 Query History (`86ba31jrq`), M9 Multi-Social Ingestion v2 (`86ba31jt0`).
- A divider task **"OLD TASKS 05-22-2026"** (`86ba31j7d`); ~27 older brainstorm tasks sit below it (likely superseded by M1–M9). One done: "Create the Design" (`86b9x62a4`).
- Pull full bodies via `clickup_get_task` (`detail_level='detailed'`) before mirroring — the M-task descriptions likely already contain the detail.

### Pending decisions (the user dismissed the question menu — re-confirm before creating anything)
- **Mechanism:** full `gh`/GraphQL Projects v2 board + native Milestones, vs. MCP issues + sub-issues.
- **Scope:** just M1–M9 epics, or M1–M9 + supporting tasks as sub-issues, or include the OLD tasks.
- **Target shape:** native Milestones + a Project board; epic issues + sub-issues; or both.
- **Source of truth:** keep ClickUp in sync or one-way migrate? Do NOT delete ClickUp tasks unless explicitly asked.
- Creating issues/board items is bulk + visible + tedious to reverse → present the issue-by-issue mapping and get approval first.

## Carry-forward — M1 movers technical context (still the active feature area)
- Poller uses each token's `sym` (e.g. `$PEPE`) as the search query; aggregates live at `AGG#<TYPE>#$SYM`, `PULSE#$SYM`.
- `PULSE#<sym>` minute buckets (`incrementPulse`, synchronous per tweet) are the per-symbol volume signal `sumPulse` reads. (`AGG#MENTION#<sym>` is @-handle mentions — the wrong signal.)
- The fix: `computeBuzzDelta` (pure, unit-tested), `sumPulse`, `updateTokenBuzz` (targeted `UpdateCommand` maintaining gsi1/gsi2; removes gsi1 when delta ≤ 0), spike-materializer disjoint current/prior hour windows, `GET /api/movers?limit=`.

## Open items / next feature slices
- **M1 Phase 2 (Movers UI)** is the natural next build — gives a tappable mobile acceptance test; `/movers` currently 404s.
- **Adjacent bug (out of scope):** `getPulse` reads `AGG#PULSE#all` but `incrementPulse` writes `PULSE#<query>` → `/api/analytics/pulse` returns nothing. Separate fix.
- **Poller liveness:** production PULSE data is >1 day stale — confirm the poller cron is running.
- M1 remaining: live-feed endpoint (reuse `QueryByQueryTime`, fan out over the user's watchlist); alerts CRUD (`alertKey` exists; needs trigger-history key + `/api/alerts`).

## Conventions (also in CLAUDE.md + the project-conventions skill)
- Lead Opus = **orchestrator**; dispatch Sonnet/Haiku subagents for code; review the real diff before reporting done. A non-blocking hook nudges you if you edit code directly. Docs/config (`*.md`, `.claude/`) you may edit directly.
- New pure logic ships with unit tests (`npm run test:unit`, CI gate). New/changed DynamoDB access patterns ship with a dynalite integration test (`npm run test:integration`, CI gate).
- Never commit/push to `master`; feature branch only. Run `npm run typecheck` + `npm run lint` before commit; discard `packages/*/tsconfig.tsbuildinfo`. Never `--no-verify`. **Open PRs only when explicitly asked.**
- User is on mobile: prefer automatic green-check verification + UI acceptance tests over hand-testing endpoints/JSON.
