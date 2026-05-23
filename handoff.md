# Session handoff — TokenBuzz roadmap + M1 movers

## Where things stand
- **Repo:** `token-buzz/website` (npm-workspaces monorepo, SST v4 on AWS). Working branch: `claude/token-buzz-clickup-tasks-fAcQ5`.
- **PR #16** is open → `master`: https://github.com/Token-Buzz/website/pull/16. Commits: roadmap docs, a settings-permission chore, the movers fix, and the movers unit test.
- typecheck + lint + the new unit test pass locally; the movers change is **not** verified against live DynamoDB.

## What happened this session
1. **ClickUp reorg.** Consolidated 26 original tasks (list `901416380123`) into 9 milestones (M1–M9) as top-level tasks, and archived the 26 originals as subtasks under an umbrella task "OLD TASKS 05-22-2026" (`86ba31j7d`). MCP server is the `clickup_*` toolset.
2. **Roadmap docs** committed: `docs/ROADMAP.md` (index + dependency graph; M1 unblocks M2/M3/M6/M8/M9; M5 orthogonal; M9 is v2) and `docs/milestones/M1..M9.md` (locked decisions, schema, phases). Each ClickUp milestone description points at its doc.
3. **First implementation slice — M1 movers.** Took M1 Phase 1 into "grounded plan mode," which revealed the movers pipeline was **wired but dead**. Fixed it (see below).
4. **Extracted + unit-tested** the delta math locally.

## The movers fix — important technical context
The `SpikeMaterializer` cron already existed in `infra/jobs.ts` (every 5 min → `packages/jobs/src/spike-materializer.handler`) but was non-functional:
- It wrote `SPIKE#<sym>` rows via `writeSpike()` that set **no `gsi1pk='SPIKE'` keys**, so `getSpikingTokens()` (which queries the `SpikingByDelta` GSI) never saw them.
- It computed deltas from a global `getPulse('1H')` *inside* the per-symbol loop → every token got the same value. And `getPulse` reads `AGG#PULSE#all`, which `incrementPulse` never writes.

Data-model facts confirmed (don't re-derive):
- The poller (`packages/jobs/src/poller.ts`) uses each token's `sym` (e.g. `$PEPE`) **as the search query**, and the aggregator writes every aggregate under `scope = query = sym`. So a token's aggregates live at `AGG#<TYPE>#$PEPE`, `PULSE#$PEPE`, etc.
- `PULSE#<sym>` minute buckets (`incrementPulse`) are bumped **synchronously per tweet** → most reliable per-symbol volume signal. (`AGG#MENTION#<sym>` is @-handle mentions, *not* token buzz — wrong signal.)

The fix:
- `packages/core/src/movers.ts` — `computeBuzzDelta(current, prior)` (pure, DB-free, so it's testable without SST).
- `packages/core/src/movers.test.ts` — 5 vitest cases, run with plain `npx vitest run` (no `sst shell`).
- `packages/core/src/db/aggregates.ts` — `sumPulse(scope, from, to)` sums `PULSE#<scope>` minute buckets.
- `packages/core/src/db/tokens.ts` — `updateTokenBuzz()` does a targeted `UpdateCommand` that refreshes `SpikingByDelta`/`WatchlistByMentions` GSI keys **without clobbering** price/name/spark; removes `gsi1` keys when delta ≤ 0. Removed dead `writeSpike`.
- `packages/jobs/src/spike-materializer.ts` — per-symbol disjoint current/prior hour windows.
- `packages/application/app/api/movers/route.ts` — `GET /api/movers?limit=`.

## Open items / next steps
- **Runtime verification still owed.** Needs a deployed stage (`sst shell`) to confirm the materializer writes rows that `/api/movers` ranks. No local DynamoDB mock exists in the repo.
- **Adjacent bug, deliberately out of scope:** `getPulse` reads `AGG#PULSE#all` but `incrementPulse` writes `PULSE#<query>` → `/api/analytics/pulse` also returns nothing. Separate fix.
- **M1 remaining phases:** live-feed endpoint (reuse `tweetQueryGsi` / `QueryByQueryTime`, fan out over the user's watchlist), alerts CRUD (`alertKey` exists; needs a trigger-history key + `/api/alerts`). Movers UI, live-feed UI, alerts UI are Phases 2–4.

## Conventions & workflow the user expects (follow these)
- **Local loop, no AWS:** branch → code → local `npm run lint` + `npm run typecheck` + `test` → commit → push → open PR → review. Lint/typecheck/pure-unit-tests need **no** AWS. Only live-DB integration needs a stage (the repo's `ddb` client eagerly reads `Resource.X.name` at import, so anything importing it crashes outside `sst shell` — extract pure logic to keep it testable).
- Add DB key builders in `packages/core/src/db/keys.ts`; never inline pk/sk. Cross-package imports via workspace names (`@monorepo-template/core/...`).
- Never commit/push to `master`; work on the feature branch. Discard `packages/*/tsconfig.tsbuildinfo` before staging. Never `--no-verify`.
- **Open PRs only when explicitly asked.**
- The user prefers the **per-milestone, one-phase-per-session plan-mode** approach: ground each milestone doc against real code before implementing, because the docs were written from the brainstorm and overstate net-new work (M1 proved this).
