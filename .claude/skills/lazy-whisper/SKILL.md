---
name: lazy-whisper
description: Working on the lazy-whisper Social Analytics page in this repo. Use when continuing the phased port (Phase 6c / Phase 7 / chart bugs / aggregator changes / ingest changes), debugging missing chart data on a staging stage, or dispatching coding subagents for analytics work. Covers SST + DDB single-table architecture, twitterapi.io ingest quirks, and the established branch/PR workflow.
---

# Lazy Whisper — Analytics Port

A multi-phase port of an analytics dashboard onto the existing `packages/application` Next.js app, deployed via SST on AWS. The original spec lives at `please-look-at-lazy-whisper.md` at the repo root — **read it once at the start of any non-trivial analytics task.**

## Phase tracker

| Phase | Branch | Status |
|---|---|---|
| 1 — Foundation (schema, geo, bot, RAKE) | `feature/phase-1-foundation` | ✅ Merged |
| 2 — `POST /api/query` ingest route | `feature/phase-2-ingest` | ✅ Merged |
| 3 — Aggregator extension (13 types) | `feature/phase-3-aggregator` | ✅ Merged |
| 4 — 19 read endpoints | `feature/phase-4-read-endpoints` | ✅ Merged |
| 5 — Frontend shell + sentiment polling | `feature/phase-5-frontend-shell` | ✅ Merged |
| 6a — 6 trivial BarList charts | `feature/phase-6a-trivial-charts` | ✅ Merged |
| 6b — 9 moderate charts | `feature/phase-6b-moderate-charts` | 🟡 Open PR |
| 6c — 4 hard charts | not started | Pending |
| 7 — Polish (sidebar entry, LICENSES.md, empty/loading/error states) | not started | Pending |

**Phase 6c charts**: `SentimentGauge`, `PostingHeatmap`, `ContentLengthEngagement`, `GeographicDistributionMap`. Note: `cities5000.json` geo dataset is still an empty placeholder from Phase 1 — backfill that before building `GeographicDistributionMap`.

## Architecture cheat sheet

- **SST v4** monorepo, npm workspaces under `packages/*`. Resource definitions in `infra/`, loaded in order via `sst.config.ts`.
- **`packages/core`** — shared DDB client, key builders, enrichment. Consumed by `application` and `jobs` via `sst.Resource` bindings. **Never imported by `marketing`.**
- **DynamoDB single-table** — four tables in `infra/db.ts`: `Tweets`, `Aggregates`, `Tokens`, `UserData`. Access only through `packages/core/src/db`.
- **Aggregator Lambda** (`packages/jobs/src/aggregator.ts`) — subscribes to the Tweets DDB stream and writes counter-style aggregates (`AGG#<TYPE>#<query>` with `BUCKET#<hour>#<value>` sk) for every chart that reads from the Aggregates table.
- **Sentiment Lambda** (`packages/jobs/src/sentiment.ts`) — subscribes to the same stream, calls **Claude Haiku 4.5 via AWS Bedrock** (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) per tweet, writes back `sentiment` + `score`, then aggregates into `AGG#SENTIMENT_BY_QUERY#<query>`.
- **Poller Lambda** (`packages/jobs/src/poller.ts`) — cron, pulls fresh tweets via twitterapi.io `since_id:` for tracked tokens. **Must call `enrichRawTweet` from `packages/core/src/lib/enrich.ts`** — same helper the ingest route uses, otherwise it silently drops 11 analytics fields.

## Recurring gotchas (every Phase has hit at least one)

### 1. `Resource.X.name` evaluates eagerly

`packages/core/src/db/client.ts` reads `Resource.Tweets.name`, `Resource.Aggregates.name`, `Resource.Tokens.name`, `Resource.UserData.name` at module load time. Any Lambda whose `link:` array omits any of these four tables will crash on cold start with `Runtime.Unknown` before the handler executes.

**Rule**: in `infra/jobs.ts` (and any future SST infra adding Lambdas that import from `@monorepo-template/core/db`), use `link: allTables`. This bug bit Phase 4 (Aggregator), Phase 6b (SentimentDispatcher). If a new Lambda fails 100% with `Runtime.Unknown`, check `link:` first.

### 2. twitterapi.io uses snake_case inside `entities`

`entities.user_mentions[].screen_name` and `entities.urls[].expanded_url` — NOT camelCase. The type in `packages/core/src/lib/twitter.ts` already reflects this. Hashtags happen to use `text` in both conventions, which is why a missing snake_case fix silently breaks Top Mentions / Domain Distribution while leaving Top Hashtags working.

### 3. Sentiment requires Bedrock model access enabled per-region

Bedrock model access has to be enabled in the AWS console for `us.anthropic.claude-haiku-4-5-20251001-v1:0` in us-east-1. The IAM `bedrock:InvokeModel` policy is necessary but not sufficient — model access is a separate gate.

### 4. tsbuildinfo files must be discarded before commit

```bash
git checkout -- packages/*/tsconfig.tsbuildinfo
```

Always. They're TypeScript incremental build cache; committing them creates noisy diffs and merge conflicts.

### 5. New AWS accounts are throttled to 10 concurrent Lambda executions

The default is 1000. If `aws lambda get-account-settings` returns `ConcurrentExecutions: 10`, the user needs to file a Support case (Service limit increase → Lambda → Concurrent executions per Region → request 1000). The standard quota-request flow refuses because it thinks the default-1000 is already applied.

### 6. Charts and the ingest pipeline have a race

A submitted query takes ~5-30s end-to-end: twitterapi.io fetch → DDB write → stream → aggregator Lambda → AggregatesTable write. Charts that fire a one-shot `useEffect` fetch will see empty data and never retry. **Always use `useAggregatePolling` (array) or `useObjectPolling` (object) from `_analytics/useAggregatePolling.ts`** — they retry on a backoff schedule and treat 429/5xx as transient. For object-shape endpoints, pass an `isPopulated` predicate so the hook doesn't settle on an all-zero response.

## Workflow conventions

- **One branch per phase**: `feature/phase-<N>-<name>`. Push at the end of each agent's work, not after every commit (avoids redeploy churn).
- **PRs are opened manually by the user**, never by Claude. Do NOT run `gh pr create` or `mcp__github__create_pull_request` unprompted.
- **Commit footer is required**: every commit must end with `https://claude.ai/code/session_01LfDX6inyWrmHi8cTYwfity` (per `CLAUDE.md`).
- **Static checks**: `npm run typecheck` and `npm run lint` must exit 0 from the repo root before every commit. Both run all workspaces.
- **Bug-fix commits land on the active phase branch** (alongside the chart work), not on a separate branch — keeps the PR scope as "phase + the fixes needed for it to work."

## Dispatching coding subagents

- **Sonnet** for any chart component, hook, or shared primitive work. Pass file paths + acceptance criteria; don't make the agent infer them.
- **Haiku** for trivial port-the-pattern work (e.g. another BarList chart).
- **Reference patterns**, don't re-derive: `useAggregatePolling`, `AnalyzingIndicator`, `BarList`, `Scatter`, `StackedAreaSVG`, the `enrichRawTweet` helper.
- **Forbid scope creep**: tell the agent which files it may NOT touch (usually anything outside `packages/application/app/(authed)/_analytics/`, `packages/application/app/api/`, and occasionally `packages/jobs/`).

Template prompt skeleton:

```
You are implementing <X> on branch <Y> (already checked out).
Read first: please-look-at-lazy-whisper.md §<section>, CLAUDE.md.
Reuse: useAggregatePolling, AnalyzingIndicator, BarList. Don't reinvent.
Files to touch: <list>. Don't touch: <list>.
Commit footer: https://claude.ai/code/session_01LfDX6inyWrmHi8cTYwfity
Static checks must pass. Discard tsbuildinfo before staging.
Push at the end; don't open a PR.
Report back under 250 words.
```

## AWS diagnostic recipes

Read-only AWS credentials are usually available. Useful one-liners when a chart is silent:

```bash
# Identify the current PR stage's resource names
aws lambda list-functions --query 'Functions[?contains(FunctionName, `pr-`) && contains(FunctionName, `ApplicationServer`)].FunctionName'
aws dynamodb list-tables --query 'TableNames[?contains(@, `pr-<N>`)]'

# Inventory aggregate types written for a query
for t in HASHTAG MENTION DOMAIN BIO_DOMAIN LANG SOURCE VERIFICATION BOT \
         HEATMAP KEYWORD AUTHOR_INFLUENCE SENTIMENT_BY_QUERY ENGAGEMENT; do
  count=$(aws dynamodb query --table-name <AggregatesTable> \
    --key-condition-expression "pk = :p" \
    --expression-attribute-values "{\":p\":{\"S\":\"AGG#${t}#\$AVAX\"}}" \
    --select COUNT --query Count --output text)
  printf '%-22s %s\n' "$t" "$count"
done

# Inspect a tweet's enrichment fields
aws dynamodb query --table-name <TweetsTable> \
  --key-condition-expression "pk = :p" \
  --expression-attribute-values '{":p":{"S":"QUERY#$AVAX"}}' \
  --projection-expression "sk, keywords, sentiment, botScore, authorBioUrls, mentions, urls" \
  --max-items 3

# Check Lambda throttle counts (concurrency-limit symptom)
aws cloudwatch get-metric-statistics --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=<lambda> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 --statistics Sum

# Tail recent app server logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/website-pr-<N>-ApplicationServerUseast1Function-<hash>" \
  --start-time $(date -d '15 minutes ago' +%s)000 \
  --filter-pattern ERROR
```

## Key file paths

- Spec: `please-look-at-lazy-whisper.md`
- Repo conventions: `CLAUDE.md`
- Analytics page shell: `packages/application/app/(authed)/analytics/page.tsx`
- Chart components: `packages/application/app/(authed)/_analytics/*.tsx`
- Polling hooks: `packages/application/app/(authed)/_analytics/useAggregatePolling.ts`
- Read endpoints: `packages/application/app/api/analytics/*/route.ts`
- Ingest route: `packages/application/app/api/query/route.ts`
- Shared enrichment: `packages/core/src/lib/enrich.ts`
- Tweet schema: `packages/core/src/db/tweets.ts`
- Aggregate key builders: `packages/core/src/db/keys.ts`
- Aggregate read helpers: `packages/core/src/db/aggregates.ts`
- Twitter API client: `packages/core/src/lib/twitter.ts`
- Aggregator: `packages/jobs/src/aggregator.ts`
- Sentiment classifier: `packages/jobs/src/sentiment.ts`, `packages/jobs/src/lib/bedrock.ts`
- Poller: `packages/jobs/src/poller.ts`
- Infra: `infra/{db,application,jobs,secrets,clerk,router,marketing}.ts`
