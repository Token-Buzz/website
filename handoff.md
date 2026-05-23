# Session handoff — TokenBuzz roadmap + M1 movers

## Where things stand
- **Repo:** `token-buzz/website` (npm-workspaces monorepo, SST v4 on AWS). Working branch: `claude/token-buzz-clickup-tasks-fAcQ5`.
- **PR #16** is open → `master`: https://github.com/Token-Buzz/website/pull/16. Branch commits now include: roadmap docs, a settings-permission chore, the movers fix + unit test, the **CI unit-test wiring** (`cacea3c`), and a **workflow-tooling commit** (test convention + `/check-tests` skill + delegate-reminder hook, `56336f8`).
- typecheck + lint + the 6 unit tests pass locally **and now in CI**. The movers change is still **not** verified against live DynamoDB.

## This session (testing infra + workflow tooling)
Context driving this work: the user works from a **mobile phone and cannot hand-test APIs/JSON endpoints**. The goal was to make correctness *automatic* (read a green check) instead of manual.
1. **Unit tests now run in CI.** `.github/workflows/deploy.yml` has a **Unit tests** step (after Typecheck, before AWS credentials, so it gates the deploy without needing AWS). Wiring: root `npm run test:unit` → `npm run test:unit --workspaces --if-present` → `packages/core`'s `test:unit` = `vitest run` (plain, **no SST stage**). The existing `npm test -w packages/core` (`sst shell vitest`) is left untouched for future DB-bound integration tests.
2. **CLAUDE.md convention added:** *"Any new pure logic (calculations, parsers, data transforms, DB key builders) ships with unit tests in the same change. CI runs these via `npm run test:unit`."*
3. **`/check-tests` skill** (`.claude/skills/check-tests/SKILL.md`): on-demand audit — diffs the branch vs `master`, flags new/changed **pure logic** lacking tests, runs `npm run test:unit`, reports gaps + pass/fail. **Advisory** (offers to write missing tests, doesn't auto-write).
4. **Delegate-reminder hook** (`.claude/hooks/remind-delegate.sh` + a `PreToolUse` entry in `.claude/settings.json`): a **non-blocking** reminder nudging the MAIN agent to dispatch a subagent for code edits. Stays **silent** for subagent edits (detected via `agent_id` in the hook stdin) and for docs/config (`*.md`, `.claude/`). **NEXT LEAD (you):** when you try to edit code directly you'll get this nudge in-context — heed it and dispatch a Sonnet/Haiku subagent. It won't block you; it's a guardrail for the CLAUDE.md orchestration rule.

## Verification model going forward (important — the user is on mobile)
- **Do NOT ask the user to curl/Postman/hand-test endpoints.** `/api/movers` is Clerk-auth-gated and a fresh stage has empty DynamoDB, so manual hits are both impractical and uninformative.
- **Pure logic →** CI green check (the Unit tests step). That's the verification surface.
- **Product features →** the **UI is the acceptance test**. Build the page, then the user taps-and-looks on mobile, and the next Claude can drive a headless browser locally to screenshot it before the user even opens it.
- **Live-DB round-trip →** still needs an **integration-test layer** (`sst shell vitest` against a deployed stage). **Not built yet.** This is the cleanest way to close the "movers not verified against live DynamoDB" gap without hand-testing.

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
- **Runtime verification still owed.** Needs a deployed stage (`sst shell`) to confirm the materializer writes rows that `/api/movers` ranks. No local DynamoDB mock exists in the repo. Recommended path: build the **integration-test layer** described above rather than hand-testing.
- **M1 Phase 2 (Movers UI) is the natural next slice.** It gives the user a tappable mobile acceptance test, and the next Claude can screenshot it from a local dev server before the user opens it. (The `/movers` page currently 404s.)
- **Adjacent bug, deliberately out of scope:** `getPulse` reads `AGG#PULSE#all` but `incrementPulse` writes `PULSE#<query>` → `/api/analytics/pulse` also returns nothing. Separate fix.
- **M1 remaining phases:** live-feed endpoint (reuse `tweetQueryGsi` / `QueryByQueryTime`, fan out over the user's watchlist), alerts CRUD (`alertKey` exists; needs a trigger-history key + `/api/alerts`). Movers UI, live-feed UI, alerts UI are Phases 2–4.

## Conventions & workflow the user expects (follow these)
- **Lead is the orchestrator.** Dispatch Sonnet/Haiku subagents for coding work (Sonnet = judgment/feature/refactor; Haiku = small mechanical edits); review the real diff before reporting done. A non-blocking hook will remind you if you edit code directly. Docs/config (`*.md`, `.claude/`) you may edit directly.
- **New pure logic ships with unit tests in the same change** — now a CI gate (`npm run test:unit`).
- **Local loop, no AWS:** branch → code → local `npm run lint` + `npm run typecheck` + `npm run test:unit` → commit → push → open PR → review. Lint/typecheck/pure-unit-tests need **no** AWS. Only live-DB integration needs a stage (the repo's `ddb` client eagerly reads `Resource.X.name` at import, so anything importing it crashes outside `sst shell` — extract pure logic to keep it testable).
- Add DB key builders in `packages/core/src/db/keys.ts`; never inline pk/sk. Cross-package imports via workspace names (`@monorepo-template/core/...`).
- Never commit/push to `master`; work on the feature branch. Discard `packages/*/tsconfig.tsbuildinfo` before staging (a Stop hook flags a dirty tree; these regenerate on every typecheck and must not be committed). Never `--no-verify`.
- **Open PRs only when explicitly asked.**
- The user prefers the **per-milestone, one-phase-per-session plan-mode** approach: ground each milestone doc against real code before implementing, because the docs were written from the brainstorm and overstate net-new work (M1 proved this).
