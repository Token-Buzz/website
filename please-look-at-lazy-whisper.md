# Analytics page — port from frontend-app-v2, wire to current feature branch backend

## Context

The user wants the **Analytics sidebar item** from `fintechmetrix/frontend-app-v2` (the `AnalyticsContainer` page, not the `live-token-metrix` page) ported into TokenBuzz's `packages/application` and wired to the new DynamoDB-backed API implemented in the current feature branch. The old reference backend (`fintechmetrix/api-caller`, Java/Spring/JPA) exposes ~24 analytics endpoints; the new TokenBuzz backend currently exposes only 5. The user has confirmed they want **both** the full page and the missing endpoints implemented, in the **existing app's bespoke style** (CSS-var primitives + inline SVG, no shadcn/recharts).

All work lands in the **current feature branch**, since that's where the new backend lives.

---

## Frontend-app-v2 Analytics page — what it does

`AnalyticsContainer.tsx` is a single-page experience driven by one search box:

1. User types a query (e.g. `$BTC`) → POST `/api/query` ingests tweets (api-caller mode).
2. After ingestion, **20 SWR hooks** fire GET requests in parallel to populate 18 charts.
3. Saved-query dropdown lets users replay/snapshot prior searches (depends on a `saved-queries` service, out-of-scope here).
4. All requests go through `apiClient` (axios) with a Bearer token interceptor and `API_CALLER_BASE = "/caller"` prefix routed via Traefik.

Layout (top → bottom, two-col grid):

| Row | Left | Right |
|-----|------|-------|
| 1 | Tweet results table (spans 2 cols) | — |
| 2 | TopHashtags | TopMentions |
| 3 | DomainDistribution | BioDomainTreemap |
| 4 | SymbolRate | EngagementTimeSeries |
| 5 | SentimentGauge | SentimentTimeline |
| 6 | KeywordWordCloud | ConversationDepth |
| 7 | GeographicDistributionMap | LanguageDistribution |
| 8 | SourceDistribution | VerificationBreakdown |
| 9 | BotRatio | PostingHeatmap |
| 10 | ContentLengthEngagement | AuthorInfluenceScatter |

---

## Endpoint mapping (frontend ↔ api-caller ↔ current feature branch)

The current feature branch is missing nearly the entire analytics surface. Items marked **NEW** must be added.

| # | Frontend hook | api-caller endpoint | current feature branch status |
|---|---|---|---|
| 1 | `searchTweets` | `POST /api/query` | **NEW** — synchronous ingest route |
| 2 | `useTopHashtags` | `GET /api/analytics/hashtags` | **NEW** |
| 3 | `useTopMentions` | `GET /api/analytics/mentions` | **NEW** |
| 4 | `useHashtagPairs` | `GET /api/analytics/hashtag-pairs` | **NEW** |
| 5 | `useTopDomains` | `GET /api/analytics/domains` | **NEW** |
| 6 | `useBioDomains` | `GET /api/analytics/bio-domains` | **NEW** — requires storing author bio URLs |
| 7 | `useSymbolRate` | `GET /api/symbols/rate?timeframe=1d` | **NEW** |
| 8 | `useEngagementTimeSeries` | `GET /api/analytics/engagement-timeseries` | **NEW** (current `/pulse` is similar shape, different data) |
| 9 | `useSentiment` | `GET /api/analytics/sentiment-by-query` | **NEW** — existing `/sentiment` (per-symbol agg) stays untouched for `SentimentGrid.tsx`; this is a new sibling route |
| 10 | `useSentimentAggregation` | `GET /api/analytics/sentiment-aggregation` | **NEW** |
| 11 | `useKeywords` | `GET /api/analytics/keywords` | **NEW** — needs keyword extractor (api-caller uses a Java extractor; we can use Bedrock or RAKE-JS) |
| 12 | `useConversationThreads` | `GET /api/analytics/conversation-threads` | **NEW** — needs `conversationId` capture from twitterapi.io |
| 13 | `useGeographicDistribution` | `GET /api/analytics/geographic` | **NEW** — **needs hosted geocoding** (see Data Sources) |
| 14 | `useLanguageDistribution` | `GET /api/analytics/language-distribution` | **NEW** — `lang` already on Tweet record |
| 15 | `useSourceDistribution` | `GET /api/analytics/source-distribution` | **NEW** — twitterapi.io does not return `source` today; route returns `[]` and chart renders explicit empty state (see §6) |
| 16 | `useVerificationBreakdown` | `GET /api/analytics/verification-breakdown` | **NEW** — twitterapi.io exposes `isBlueVerified` and `verifiedType`, so the full breakdown is achievable after the type expansion (see §4 Step 1) |
| 17 | `useBotRatio` | `GET /api/analytics/bot-ratio` | **NEW** — uses `isAutomated` from twitterapi.io (confirmed available via api-caller `Author.java`) **plus** heuristic fallback (see §4 Approach B) |
| 18 | `usePostingHeatmap` | `GET /api/analytics/posting-heatmap` | **NEW** — `createdAt` already on Tweet |
| 19 | `useContentLengthEngagement` | `GET /api/analytics/content-length-engagement` | **NEW** — text length × engagement (computable from existing fields) |
| 20 | `useAuthorInfluence` | `GET /api/analytics/author-influence` | **NEW** — followers × engagement (computable) |
| — | `useFollowerHistory` | `GET /api/analytics/follower-history` | Not used by Analytics page (drilldown) — can defer |
| — | `useEngagementDecay` | `GET /api/analytics/engagement-decay` | Not used by Analytics page (drilldown) — can defer |

---

## Data sources needed

### 1. Twitter ingestion — already wired
- `TWITTER_API_KEY` already declared in `infra/jobs.ts` as `sst.Secret("TwitterApiKey")`.
- `packages/jobs/src/lib/twitter.ts` already calls `twitterapi.io/twitter/tweet/advanced_search`.
- For on-demand ingestion (`POST /api/query`) the route must call this same client, then `putTweet` each result. Reuse the existing function — it accepts a query string and returns up to `maxPages * 20` tweets.

### 2. Geocoding — hybrid offline + API with permanent cache

api-caller used a self-hosted **GeoNames** dump in MySQL (~1.5GB). User confirmed that was too expensive to run and wants something cheaper.

**Decision: hybrid two-layer lookup, results cached forever in DynamoDB.**

**Layer 1 — offline match (primary)**: bundle GeoNames `cities5000.zip` (~50k cities with population ≥5,000, ~5MB normalized JSON) inside the Next.js app at `packages/application/lib/geo/cities5000.json` (committed to repo). Load into an in-memory index at module init, keyed by lowercased city name + alternate names. Resolves ~80% of real Twitter locations with zero cost and zero latency.

**Layer 2 — OpenCage API (fallback)**: for misses, call `https://api.opencagedata.com/geocode/v1/json?q=<raw>&key=<key>`.
- Free tier: 2,500 lookups/day; $50/mo for 10k/day.
- OpenCage's ToS **explicitly permits permanent storage of results** (implementer should reconfirm at build time).
- Once the cache warms (likely within days), API hits drop to near zero.

**Pre-filter — skip lookup entirely for obvious junk** (never touches cache or API):

1. Empty / whitespace-only.
2. Length < 2 after trim.
3. Emoji-only / no alpha chars after stripping `[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]`.
4. Pronoun denylist (case-insensitive): `"she/her"`, `"they/them"`, `"he/him"`, `"she/they"`, `"he/they"`, `"any/all"`. Live inline at `packages/application/lib/geo/denylist.ts`.

**Cache table — new SST Dynamo resource `AuthorLocations`** (added in `infra/application.ts`, linked to the app):

| Field | Type | Purpose |
|---|---|---|
| `pk` | `GEO#<raw-lowercased-trimmed>` | Primary key |
| `sk` | `"META"` | Static |
| `raw` | string | Original input |
| `country` | string? | Display name |
| `countryCode` | string? | ISO 3166-1 alpha-2 |
| `lat` | number? | Decimal degrees |
| `lng` | number? | Decimal degrees |
| `source` | `"bundled"` \| `"opencage"` \| `"miss"` | Which layer resolved it |
| `lookedUpAt` | ISO string | Timestamp |

**No TTL** — location dictionaries don't move. Misses cached too (`source: "miss"`) so we never re-pay for `"asdfasdf"`.

**Helper** at `packages/core/src/db/geo.ts` — `lookupLocation(raw)`:
1. Pre-filter → return null if junk.
2. DDB cache hit → return cached (miss rows map to null).
3. Try offline bundled match → write-through, return.
4. Call OpenCage. On 429/5xx, **write nothing** and return null (next ingest will retry). On 404/no result, write `source: "miss"`. On success, write full row.

**Failure modes**:
- OpenCage rate-limited or 5xx → cache untouched, retried next ingest. No permanent poisoning.
- OpenCage 404 → cached as miss, never retried.
- Pre-filter rejection → never touches cache or API.

**Secret**: add `opencageApiKey = new sst.Secret("OPENCAGE_API_KEY")` in `infra/secrets.ts`. Pass into the Nextjs app via `infra/application.ts` environment block alongside Clerk keys.

**Volume sanity check**: ~100 authors per ingest, mostly repeats; realistic <100 unique new locations/day after warmup. Well inside OpenCage's free tier.

### 3. Sentiment — already wired
Bedrock Haiku via `packages/jobs/src/sentiment.ts`. Already runs on tweet INSERT stream. `Tweet.sentiment` + `Tweet.sentimentScore` are populated async.

### 4. Bot detection — Twitter flag + heuristic (Approach B)

**Decided: Approach B** — combine Twitter's self-labeled flag with a 5-signal behavioural heuristic.

**Important: bot detection is informational only.** Bot-scored tweets are **never filtered out**. They are ingested, stored, and counted in every other chart (Top Hashtags, Sentiment, Engagement, etc.) exactly like human tweets. The score is consumed exclusively by `/api/analytics/bot-ratio` to surface context to the user, e.g. *"21% of this query's authors look automated."*

**Step 1 — expand `TwitterAuthor` type** in `packages/jobs/src/lib/twitter.ts` to surface the fields twitterapi.io already returns (confirmed via api-caller `Author.java`):

- `createdAt` (account age)
- `isAutomated` (Twitter's self-label flag)
- `verifiedType` (legacy/business/government)
- `mediaCount`, `favouritesCount`

**Step 2 — compute `botScore` (0–1) at ingest, per author.** Skip if author is already stored with a score (dedupe across tweets in same query).

| Signal | Weight | Trigger |
|---|---|---|
| Posts per day | 0.35 | `statusesCount / age_days` ≥ 50 → +1 (linear ramp to 1.0 at 200/day) |
| Account age | 0.25 | account < 30 days old → +1 |
| Default PFP + empty bio combined | 0.25 | profilePicture URL contains `default_profile_images` OR is missing → +0.5; `description.length < 10` → +0.5 |
| Follower/following ratio | 0.15 | `followers / following` < 0.1 → +1 |

Weights sum to 1.00. Score is clamped `[0, 1]`. (We dropped the username-digit-pattern signal per user feedback to keep the heuristic tight.)

**Step 3 — combine with Twitter flag:**

```
isLikelyBot = author.isAutomated === true || botScore >= 0.5
```

Trust Twitter's explicit label when present; fall back to heuristic otherwise.

**Where computed**: at ingest time inside `POST /api/query`, once per unique author per ingest batch. Store `botScore` and `isAutomated` on the Tweet record (redundant across tweets by same author but cheap). No second pass needed at chart-query time.

### 5. Bot-ratio response shape — extend with `methodology`

Extend the api-caller shape with a single self-documenting field so the chart can render a disclaimer hover ("Estimate based on Twitter flags + behavioural heuristics"):

```ts
export interface BotRatio {
  automated: number              // count of authors with isAutomated === true || botScore >= 0.5
  notAutomated: number
  automatedPercentage: number    // 0–100, rounded to 1 decimal
  methodology: "hybrid"          // NEW — always "hybrid" in v1
}
```

This adds **one line** to the frontend types at `packages/application/types/twitter-analytics.ts` (or wherever the ported types land). All other endpoints keep the api-caller shape exactly.

### 6. Source field — likely unsupported
twitterapi.io's RawTweet does not include `source` (Twitter app name). The chart should be hidden behind a feature flag or stubbed with a `not-available` empty state.

---

## Implementation plan

### Phase A — Schema extensions (packages/core)

`packages/core/src/db/tweets.ts` — extend `Tweet` type with:
- `conversationId?: string`
- `inReplyToId?: string`
- `authorCreatedAt?: string` (account age — needed for bot heuristic)
- `authorBioUrls?: string[]` (extracted at ingest from `author.description`)
- `authorIsBlueVerified?: boolean`
- `authorVerifiedType?: string` (legacy/business/government if available)
- `authorIsAutomated?: boolean` (Twitter's self-label flag, when present)
- `authorLocationRaw?: string`
- `authorLocationNormalized?: { country?: string; lat?: number; lng?: number }`
- `botScore?: number` (0-1 heuristic; see §4 above)
- `keywords?: string[]` (pre-extracted at ingest via RAKE-JS so `/analytics/keywords` reads from rollup, not raw text)

Update helpers in `packages/core/src/db/tweets.ts`:
- `getTweetsByQuery(query, opts)` — extend signature to take `window: '1H'|'4H'|'24H'|'7D'` and `cap?: number` (default 2000). Returns `{ items, truncated }`. Used only by the 3 live-scan endpoints (content-length-engagement, hashtag-pairs, conversation-threads).

### Phase B — New API routes (packages/application/app/api/analytics/*)

All routes follow this template (consistent with existing routes):

```ts
import { auth } from "@clerk/nextjs/server";
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });
  // ...query DDB, compute aggregate, return JSON shape matching api-caller
}
```

New route files to create (all under `packages/application/app/api/`):

1. `query/route.ts` — `POST /api/query` (ingest)
2. `analytics/hashtags/route.ts`
3. `analytics/mentions/route.ts`
4. `analytics/hashtag-pairs/route.ts`
5. `analytics/domains/route.ts`
6. `analytics/bio-domains/route.ts`
7. `analytics/sentiment-by-query/route.ts` — **new** sibling to the existing `/sentiment` (per-symbol agg) route. Existing route stays untouched; `SentimentGrid.tsx` continues to consume it.
8. `analytics/sentiment-aggregation/route.ts`
9. `analytics/keywords/route.ts`
10. `analytics/engagement-timeseries/route.ts`
11. `analytics/conversation-threads/route.ts`
12. `analytics/geographic/route.ts`
13. `analytics/language-distribution/route.ts`
14. `analytics/source-distribution/route.ts` — same shape as other distribution endpoints; returns `[]` until/unless twitterapi.io starts surfacing `source`
15. `analytics/verification-breakdown/route.ts`
16. `analytics/bot-ratio/route.ts`
17. `analytics/posting-heatmap/route.ts`
18. `analytics/content-length-engagement/route.ts`
19. `analytics/author-influence/route.ts`
20. `symbols/rate/route.ts`

**Response shapes**: match `frontend-app-v2/types/twitter-analytics.ts` exactly so we don't need to fork the frontend types. Exceptions: `BotRatio` gets a `methodology: "hybrid"` field (see §5 above); live-scan endpoints (see below) get a `truncated: boolean` field.

### Compute strategy — stream-driven rollups + bounded live scan

**Decided: rollup-backed reads via the existing `Aggregates` table**, populated by extending the existing aggregator Lambda (`packages/jobs/src/aggregator.ts`). Three endpoints that can't roll up cleanly fall back to a time-windowed live scan with a hard cap.

**Endpoint split:**

| Type | Endpoints | How |
|---|---|---|
| **Rollup-backed** (15) | hashtags, mentions, domains, bio-domains, language-distribution, source-distribution, verification-breakdown, bot-ratio, posting-heatmap, sentiment-by-query, sentiment-aggregation, author-influence, engagement-timeseries, keywords, symbols/rate | Range query `Aggregates` table within window, merge counts in Lambda, return top-K |
| **Live-scan** (3) | content-length-engagement (scatter — needs raw points), hashtag-pairs (combinatorial), conversation-threads (per-thread joining) | DDB Query on `QueryByQueryTime` GSI with time-window + 2000 tweet hard cap; include `truncated: boolean` in response |

**Rollup schema** — reuses existing `aggregateKey` pattern (`packages/core/src/db/keys.ts`):

```
pk: AGG#<TYPE>#<query>            e.g. AGG#HASHTAG#$BTC
sk: BUCKET#<hour-iso>#<value>     e.g. BUCKET#2026-05-17T14:00:00Z#bullish
count: number
```

Read pattern: `pk = AGG#<TYPE>#<query> AND sk BETWEEN BUCKET#<from-hour> AND BUCKET#<to-hour>`, merge by value in Lambda, sort desc, slice top-K. One range query per chart, no GSI hop needed.

For shape-variant aggregates (sentiment-aggregation, bot-ratio, verification-breakdown — fixed-cardinality histograms), the bucket sk just holds the bucket label and the row stores a JSON `histogram` map.

**Aggregator Lambda extension** (`packages/jobs/src/aggregator.ts`):

On each tweet INSERT, fan out to **13 new aggregate types** (in addition to the existing `pulse` and `sentiment-by-symbol` types already handled): `HASHTAG`, `MENTION`, `DOMAIN`, `BIO_DOMAIN`, `LANG`, `SOURCE`, `VERIFICATION`, `BOT`, `HEATMAP`, `KEYWORD`, `AUTHOR_INFLUENCE`, `ENGAGEMENT`, `SENTIMENT_BY_QUERY`. (`SYMBOLS_RATE` reuses the `ENGAGEMENT` rollup with a different scope.) Each write is the same pattern:

```ts
await ddb.send(new UpdateCommand({
  TableName: Resource.Aggregates.name,
  Key: { pk: `AGG#${type}#${query}`, sk: `BUCKET#${hourBucket}#${value}` },
  UpdateExpression: 'ADD #c :one',
  ExpressionAttributeNames: { '#c': 'count' },
  ExpressionAttributeValues: { ':one': 1 },
}));
```

Bio-domain, verification, and bot-ratio aggregates fan out **once per unique author per query**, not per tweet — dedup using a tiny per-invocation Set.

Estimated additions: ~300 LOC, mostly repetitive `ADD :one` increments + a few JSON-map merge writes for the histogram-shape aggregates.

**Live-scan helper** (`packages/core/src/db/tweets.ts`):

Extend `getTweetsByQuery` to accept a `window` param:

```ts
export async function getTweetsByQuery(
  query: string,
  opts: { window: '1H'|'4H'|'24H'|'7D'; cap?: number } = { window: '24H' },
): Promise<{ items: TweetRecord[]; truncated: boolean }>
```

Internally uses the existing `QueryByQueryTime` GSI with `gsi1sk BETWEEN <from> AND <to>`. Pagination stops once `cap` (default 2000) is reached. `truncated` flag reflects whether we hit it.

### Idempotency

DynamoDB Streams delivers at-least-once; the same tweet INSERT can fire the aggregator twice → counters double-count. Real-world dup rate is <1%.

**v1 decision: accept and document.** Tradeoff acknowledged. If we ever need exact counts, options are per-tweet `processed` markers (1 extra conditional write per increment) or Lambda Powertools idempotency. Out of scope for v1.

### Backfill

Existing tweets in DDB won't have rollups when this ships. Since current stages are all dev/PR-tier (no production data yet):

**v1 decision: reset the Tweets table for any stage that's adopting these changes.** No backfill script needed. New tweets populate rollups as they arrive; charts may look sparse for the first ingest cycle.

A future backfill script can live at `packages/scripts/backfill-aggregates.ts` (`sst shell tsx`) — scans Tweets table, replays aggregator logic. Not required for v1.

### Phase C — Frontend page (packages/application/app/(authed)/analytics/page.tsx)

Replace the existing placeholder page wholesale. Match existing dashboard style:

- Use `Card`, `SectionHead`, `Eyebrow`, `Sparkline`, `Delta`, `Ticker`, `Pill`, `fmtCount` from `app/(authed)/_dashboard/primitives.tsx` — **NOT** the older `app/_dashboard/primitives.tsx` copy, which is the legacy sample-dashboard set.
- All charts in inline SVG (no recharts).
- Data fetching: plain `fetch()` in `useEffect` hooks (no axios, no SWR — matches existing dashboard components like `KPIStrip.tsx`/`PulseSection.tsx`).
- Search input at the top → on submit, POST `/api/query` then re-fetch all charts.
- A query state in URL (`?q=$BTC`) so users can share/refresh.

**Shared primitives to build first** (extract before charts, reused across many):

- `BarList.tsx` — horizontal bar list with rank/label/bar/count. Used by 5 charts.
- `Scatter.tsx` — SVG scatter plot. Used by 2 charts.
- (Existing primitives already cover: `Card`, `SectionHead`, `Eyebrow`, `Sparkline`, `Delta`, `Ticker`, `Pill`, `Icon`, `fmtCount`, `Button`.)

**Static assets to add** (committed to `packages/application/public/`):

- `public/maps/world.svg` — pre-built world map with ISO-2 country codes as `<path id="...">` attributes. Source: amCharts free SVG maps (MIT-licensed) at `https://www.amcharts.com/svg-maps/?map=world`. ~150KB.

**Charts to build** (one component per file under `app/(authed)/_analytics/`):

| # | File | Visual approach | Effort |
|---|---|---|---|
| 1 | `SearchBar.tsx` | Input + submit; syncs `?q=` to URL via `useSearchParams` | 30m |
| 2 | `TweetsResultsTable.tsx` | Adapt style from existing `TweetStream.tsx` | 1.5h |
| 3 | `TopHashtagsChart.tsx` | `<BarList>` | 30m |
| 4 | `TopMentionsChart.tsx` | `<BarList>` | 30m |
| 5 | `DomainDistributionChart.tsx` | `<BarList>` | 30m |
| 6 | `BioDomainsChart.tsx` | `<BarList>` (was BioDomainTreemap — switched to bar list for style consistency; treemap deferred to v1.1) | 30m |
| 7 | `LanguageDistributionChart.tsx` | `<BarList>` + small inline donut summary | 1h |
| 8 | `SourceDistributionChart.tsx` | Empty state with explanation: *"Source field not available from twitterapi.io"* | 30m |
| 9 | `SymbolRateChart.tsx` | Single number + existing `<Sparkline>` | 30m |
| 10 | `EngagementTimeSeriesChart.tsx` | Stacked area in SVG (likes/RT/replies/quotes); requires path math | 2h |
| 11 | `SentimentGaugeChart.tsx` | 180° semicircle gauge SVG with arc + needle, fed by `sentiment-aggregation.averageScore` | 3h |
| 12 | `SentimentTimelineChart.tsx` | Port `SentimentTimeline` from existing `app/(authed)/analytics/page.tsx` placeholder (already SVG) | 30m |
| 13 | `KeywordWordCloud.tsx` | Flexbox of `<Pill>` elements, font-size scaled to frequency (tag-cloud style, not bin-packed) | 1h |
| 14 | `ConversationDepthChart.tsx` | Vertical bar histogram in SVG | 1.5h |
| 15 | `GeographicDistributionMap.tsx` | Load `public/maps/world.svg` as inline SVG; color `<path>` elements by tweet count via JS; hover tooltip showing country + count | 4h |
| 16 | `VerificationBreakdownChart.tsx` | Stacked horizontal bar (blue/business/government/unverified) | 1.5h |
| 17 | `BotRatioChart.tsx` | Single percentage + small two-segment bar + methodology hover tooltip | 1.5h |
| 18 | `PostingHeatmap.tsx` | 7×24 SVG grid; cell fill opacity scaled to count (linear or log) | 4h |
| 19 | `ContentLengthEngagementChart.tsx` | `<Scatter>` (text length × engagement); server samples to 500 points if larger | 3h |
| 20 | `AuthorInfluenceScatter.tsx` | `<Scatter>` (followers × engagement rate) | 1.5h |

**Total estimated effort**: ~30 hours of focused chart work. Build the two shared primitives first (`BarList`, `Scatter`) so the trivial charts are nearly free afterward.

**Design decisions captured above:**

- **BioDomains**: ships as bar list, not treemap. Treemap deferred to v1.1 if there's appetite for visual variety later.
- **GeographicDistributionMap**: real inline SVG map (not bar list), zero new dependencies, ~4h work. Color-fills country `<path>` elements by tweet count from `/api/analytics/geographic`.
- **KeywordWordCloud**: tag-cloud style (sized pills in flexbox), not bin-packed word cloud. ~30 LOC.
- **SourceDistribution**: explicit empty state with explanation. Endpoint exists, returns `[]` until twitterapi.io ever surfaces `source`.

Skip `SavedQueryDropdown` and `QueryPill` for v1 — they depend on a saved-queries service (`user-prefs`) that isn't part of this scope.

#### Sentiment polling

The Bedrock sentiment Lambda runs async on the Tweets table INSERT stream. For novel queries (not in the background poller's tracked-token list), there will be a window after `POST /api/query` returns where the page renders but `/api/analytics/sentiment-by-query` and `/api/analytics/sentiment-aggregation` are still empty.

**Decision: port the polling pattern from `frontend-app-v2/components/analytics/AnalyticsContainer.tsx`.**

Page-level effect, triggered after a successful `POST /api/query`:

1. Set `sentimentWaitUntil = Date.now() + 30_000`.
2. After 1s, fire a sentiment refetch.
3. If response is non-empty → clear `sentimentWaitUntil`, stop polling.
4. Else schedule next attempt with exponential backoff: 2s, 4s, 8s, 8s, 8s.
5. If `Date.now() > sentimentWaitUntil` at any point, give up.

While `sentimentWaitUntil` is set, the two sentiment chart components show a small *"Analyzing sentiment…"* status (use existing `Spinner` if present, or a styled inline note). The other 17 charts render immediately on their first fetch — they don't wait.

**Stop condition: first non-empty result** (matches original). Sentiment for some tweets may still be in-flight; subsequent natural re-renders pick those up. Trying to wait for "fully complete" (count parity with ingest) blocks longer on outlier tweets and isn't worth the latency.

**No backend changes needed** — the existing `packages/jobs/src/sentiment.ts` Lambda and `Tweets` stream subscription already do the right thing. This is purely frontend polling against existing endpoints.

**Graceful degradation for popular queries**: the `packages/jobs/src/poller.ts` runs every 2 minutes against tracked queries (`$PEPE`, `$SOL`, etc.). For those, most tweets already have sentiment by the time a user clicks, so the polling window completes on the first attempt (~1s).

### Phase D — Sidebar entry

Add `Analytics` link to whatever sidebar / nav lives in `app/(authed)/_dashboard/Shell.tsx` (already uses a route-driven shell). Confirm by reading `Shell.tsx` during implementation.

---

## Implementation sequencing

The work has natural seams that map to commit/PR boundaries. **Each phase ends in a demonstrably working state** — partial completion is always useful.

### Sequence

| # | Phase | What ships | Demoable as | Est. |
|---|---|---|---|---|
| 1 | **Foundation** | TweetRecord schema extensions, `AuthorLocations` SST table, expanded `TwitterAuthor` type, geo cache lib (`packages/core/src/db/geo.ts` + `cities5000.json` + denylist), bot heuristic util, RAKE-JS keyword extractor wrapper | Unit tests on geo/bot/RAKE | 4-6h |
| 2 | **Ingest path** | `POST /api/query` route. Calls existing `searchTweets` from twitter.ts, runs all extractors (URLs, bio URLs, bot score, keywords, geo lookup), writes via extended `putTweet` | `curl POST /api/query` lands tweets in DDB with every new field populated | 3-4h |
| 3 | **Aggregator** | Extend `packages/jobs/src/aggregator.ts` with 12 new fan-out writes (hashtags, mentions, domains, bio-domains, languages, sources, verification, bot, posting-heatmap, sentiment-aggregation, author-influence, engagement-timeseries, keywords, symbols/rate). Add aggregate key builders in `keys.ts` and read helpers in `aggregates.ts` | After Phase 2 ingest, rollup rows exist in `Aggregates` table; verify via direct DDB scan | 4-6h |
| 4 | **Read endpoints** | 18 GET routes (15 rollup-backed + 3 live-scan: content-length-engagement, hashtag-pairs, conversation-threads) | `curl` each route, response shape matches `frontend-app-v2/types/twitter-analytics.ts` | 6-8h |
| 5 | **Frontend shell + primitives** | Page rewrite, `SearchBar`, `BarList`, `Scatter` shared primitives, sentiment polling effect, URL-synced `?q=` state | Page renders with mock data; URL state works; SearchBar fires `POST /api/query` | 4-6h |
| 6 | **Chart components** | 19 charts, built in order of difficulty for early visible wins. See sub-ordering below | Each chart that ships renders real data from its endpoint | ~30h |
| 7 | **Polish** | Sidebar entry, empty/loading/error states across all charts, attribution (`LICENSES.md` for cities5000 + amCharts world.svg), manual smoke test | Production-ready | 4-6h |

**Total: ~55-65h, roughly 1.5-2 focused weeks.**

### Phase 6 sub-ordering (charts by difficulty)

Each sub-batch ships independent visible value:

- **6a — Trivial (~3h)**: TopHashtagsChart, TopMentionsChart, DomainDistributionChart, BioDomainsChart, LanguageDistributionChart, SourceDistributionChart. All use `<BarList>`.
- **6b — Moderate (~11h)**: TweetsResultsTable (1.5h), SymbolRateChart (0.5h), SentimentTimelineChart (0.5h), ConversationDepthChart (1.5h), VerificationBreakdownChart (1.5h), BotRatioChart (1.5h), KeywordWordCloud (1h), EngagementTimeSeriesChart (2h), AuthorInfluenceScatter (1.5h — uses the `<Scatter>` primitive).
- **6c — Hard (~16h)**: SentimentGaugeChart (3h), PostingHeatmap (4h), ContentLengthEngagementChart (3h — uses `<Scatter>` like AuthorInfluence but adds server-side sampling), GeographicDistributionMap (4h), plus 2h budget for primitive integration polish.

### Parallelization opportunities

- **After Phase 3**: Phase 4 (18 routes) and Phases 5-6 can run in parallel. Frontend can stub against constants like `const MOCK_HASHTAGS = [...]` until each endpoint lands.
- **Within Phase 4**: 18 routes are independent — split across contributors freely.
- **Within Phase 6**: 19 charts are independent once primitives exist. Easy to split.

### Critical paths

- Phase 2 ingest blocks everything that needs real data
- Phase 3 aggregator blocks the 15 rollup-backed endpoints (Phase 4)
- Phase 5 primitives (`BarList`, `Scatter`) block ~80% of Phase 6

### What can be skipped if scope tightens further

If time pressure hits during implementation, here's the cut list in order:

1. **Phase 6c hard charts** — ship 6a + 6b only (~14h of chart work instead of 30h). Page would still have 14 working charts.
2. **GeographicDistributionMap** specifically — drop back to bar list (~30min vs ~4h) if the map turns out trickier than expected.
3. **Pre-extracted keywords + RAKE wrapper** — defer KeywordWordCloud entirely.
4. **Sentiment polling** — accept the empty-state UX for novel queries; revisit when a user actually complains.

---

## Critical files to read/modify

- `D:/Repositories/tokenbuzz/website/packages/core/src/db/tweets.ts` — extend schema
- `D:/Repositories/tokenbuzz/website/packages/core/src/db/aggregates.ts` — add ~12 new read helpers (one per rollup-backed endpoint)
- `D:/Repositories/tokenbuzz/website/packages/core/src/db/keys.ts` — add aggregate key builders for new types: HASHTAG, MENTION, DOMAIN, BIO_DOMAIN, LANG, SOURCE, VERIFICATION, BOT, HEATMAP, KEYWORD, AUTHOR_INFLUENCE, ENGAGEMENT, SENTIMENT_BY_QUERY (13 types)
- `D:/Repositories/tokenbuzz/website/packages/jobs/src/aggregator.ts` — extend stream handler with 13 new fan-out writes per tweet INSERT (see Compute strategy)
- `D:/Repositories/tokenbuzz/website/packages/jobs/src/poller.ts` — capture extra fields at ingest
- `D:/Repositories/tokenbuzz/website/packages/jobs/src/lib/twitter.ts` — extend `RawTweet` type
- `D:/Repositories/tokenbuzz/website/packages/application/app/(authed)/_dashboard/primitives.tsx` — **canonical** primitives to reuse (NOT the older `app/_dashboard/primitives.tsx`)
- `D:/Repositories/tokenbuzz/website/packages/application/app/(authed)/analytics/page.tsx` — full rewrite
- `D:/Repositories/tokenbuzz/website/packages/application/app/api/analytics/*` — add new routes
- `D:/Repositories/tokenbuzz/website/infra/secrets.ts` — add `OPENCAGE_API_KEY` secret
- `D:/Repositories/tokenbuzz/website/infra/application.ts` — add `AuthorLocations` Dynamo table + link, pass `OPENCAGE_API_KEY` env to Next.js
- `D:/Repositories/tokenbuzz/website/packages/application/lib/geo/cities5000.json` — bundled offline dataset (NEW, ~5MB)
- `D:/Repositories/tokenbuzz/website/packages/application/lib/geo/denylist.ts` — pronoun denylist (NEW)
- `D:/Repositories/tokenbuzz/website/packages/application/public/maps/world.svg` — world map static asset (NEW, ~150KB, amCharts MIT)
- `D:/Repositories/tokenbuzz/website/packages/core/src/db/geo.ts` — `lookupLocation` helper (NEW)
- Reference (read-only): `D:/Repositories/tokenbuzz/api-caller/src/main/java/com/example/apicallergitlab/Data/Service/AnalyticsService.java` — for SQL → DDB translation cues

---

## Verification — acceptance criteria for v1

Each item below must pass for v1 to be considered done. Pass/fail criteria are concrete; ambiguity here is what stretches a release.

### Static checks

- [ ] `npm run typecheck` from repo root — exit 0, all packages compile.
- [ ] `npm run lint` from repo root — exit 0, no errors (warnings OK).
- [ ] `npx sst dev --stage <dev-stage>` boots cleanly — no missing secrets, no missing table refs.
- [ ] All new secrets are documented in this plan AND present in the dev SST Console environment: `OPENCAGE_API_KEY`. (`TwitterApiKey` already exists.)
- [ ] `LICENSES.md` exists at repo root with attribution for: GeoNames cities5000 (CC-BY 4.0), amCharts world.svg (MIT).

### Backend — POST /api/query (ingest)

- [ ] Without Clerk session → 401.
- [ ] With session, missing body → 400.
- [ ] With session, `{ query: "$PEPE" }` → 200 within **25s** for ≤100 tweets ingested.
- [ ] Response shape: `{ ingested: number, query: string }`.
- [ ] After call, DDB `Tweets` table contains rows where every new field is populated (or explicitly null): `conversationId`, `inReplyToId`, `authorCreatedAt`, `authorBioUrls`, `authorIsBlueVerified`, `authorIsAutomated`, `authorLocationRaw`, `authorLocationNormalized`, `botScore`, `keywords`.
- [ ] Within **60s** of ingest, `Aggregates` table contains rollup rows for at least: HASHTAG, MENTION, DOMAIN, LANG, VERIFICATION, BOT, HEATMAP, AUTHOR_INFLUENCE, ENGAGEMENT — verify via direct DDB scan.

### Backend — read endpoints (18 routes)

For each route under `/api/analytics/*` and `/api/symbols/rate`:

- [ ] Without Clerk session → 401.
- [ ] With session, no required params → 400 (except `symbols/rate` which only needs `timeframe`).
- [ ] With session and valid params → 200 within **2s** (rollup-backed) or **5s** (live-scan).
- [ ] Response shape matches `frontend-app-v2/types/twitter-analytics.ts` exactly, with two documented exceptions:
  - [ ] `/bot-ratio` response includes `methodology: "hybrid"` field.
  - [ ] Live-scan endpoints (`/content-length-engagement`, `/hashtag-pairs`, `/conversation-threads`) include `truncated: boolean`.
- [ ] Empty-result case (query returns no data) → 200 with empty array / zero counts, not 500.

### Backend — geo lookup behavior

- [ ] First call for `"New York"` → resolved via bundled `cities5000.json`, **no external call** (verify in OpenCage dashboard or local log).
- [ ] First call for an obscure location not in cities5000 (e.g. `"Banepa, Nepal"`) → triggers OpenCage call, writes row to `AuthorLocations` with `source: "opencage"`.
- [ ] Second call for the same obscure location → hits DDB cache, **no second OpenCage call**.
- [ ] Pre-filter inputs (`""`, `"x"`, `"🌎"`, `"she/her"`) → returns null, **no cache write**, **no API call**.
- [ ] Force a 429 response from OpenCage (mock or temporarily revoke key) → function returns null, **does NOT write a miss row** (so next ingest can retry).
- [ ] 404 from OpenCage → writes `source: "miss"` row; subsequent calls hit cache.

### Frontend — page-level acceptance

- [ ] Sign in → navigate to `/analytics` → page renders the search bar and empty-state placeholders for all 19 chart positions in <2s.
- [ ] Submit query `$PEPE` → URL updates to `?q=%24PEPE` → all charts begin loading.
- [ ] All non-sentiment charts render real data within **10s** of submit.
- [ ] Sentiment charts render with `"Analyzing sentiment…"` indicator, then resolve to real data within 30s (or stay in indicator state if Bedrock is slow — acceptable in v1).
- [ ] Refresh the page with `?q=%24PEPE` → query persists, charts re-fetch and re-render with the same state.

### Frontend — per-chart acceptance

For each of the 19 charts:

- [ ] Renders without console errors.
- [ ] Renders an empty state ("No data") when its endpoint returns empty, NOT a stack trace.
- [ ] Renders an error banner when its endpoint returns 5xx, NOT a stack trace.
- [ ] Renders a loading state (skeleton or spinner) during fetch.

Specific chart-level acceptance:

- [ ] `SourceDistributionChart` always renders the "Source field not available from twitterapi.io" empty state in v1.
- [ ] `BotRatioChart` shows a methodology tooltip on hover that explains "estimate based on Twitter flags + behavioural heuristics".
- [ ] `GeographicDistributionMap` colors at least one country `<path>` when the response has data; hovering a colored country shows a tooltip with country name + count.
- [ ] `PostingHeatmap` cells visibly differ in opacity/color across the 7×24 grid (i.e. heatmap actually shows variance, not all-same).
- [ ] `TweetsResultsTable` shows the 20 most recent tweets from the result set, sorted desc by `createdAt`.

### Edge case acceptance

- [ ] Query with no Twitter results (e.g. `$ASDFASDFASDF`) → page renders all charts in empty state, no errors.
- [ ] Sentiment Lambda failure (forced by temporarily breaking Bedrock IAM) → other 17 charts still render correctly; sentiment charts stay in "analyzing" state.
- [ ] Query a second time with the same term → cache hits keep ingest faster (verify via timing); aggregates merge correctly with prior data.

### Non-goals for v1 (out of scope, NOT verification gates)

- Saved queries / snapshot rehydration (`SavedQueryDropdown`, `QueryPill`)
- Drilldown views (`useFollowerHistory`, `useEngagementDecay`)
- Real-time push updates (only fetch-on-submit + sentiment polling)
- Mobile responsiveness (page is desktop-first, like the rest of the dashboard)
- Internationalization
- Automated tests beyond typecheck/lint — `packages/core` is the only workspace wired for vitest; add unit tests for `lookupLocation`, bot heuristic, and RAKE wrapper in a follow-up

---

## Excluded from scope — api-caller endpoints we intentionally do NOT port

Verified by reading the api-caller source. These are either machine-to-machine
calls (gated by the `X-Internal-API-Key` header via `InternalApiKeyFilter.java`),
debug/admin dumps the frontend never consumes, or duplicates. Do not waste
time re-creating them in the current feature branch.

| Endpoint | Why skipped |
|---|---|
| `POST /api/internal/sentiment/backfill` | M2M admin tool. In the current feature branch, backfill is a `packages/scripts` invocation, not a route. |
| `GET /api/internal/sentiment/status` | M2M monitoring counterpart to backfill. Same reasoning. |
| `POST /api/internal/sentiment/results` | M2M **callback from api-ai**. Unneeded — the current feature branch's Bedrock Lambda (`packages/jobs/src/sentiment.ts`) writes results to DDB inline; no callback round-trip exists. |
| `GET /api/data/author` | Raw table dump (`AllDataController`). AnalyticsContainer never calls it. |
| `GET /api/data/author_bio_url` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/data/symbols` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/data/tweet` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/data/tweet_hashtag` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/data/tweet_mention` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/data/tweet_query_count` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/data/tweet_url_entity` | Raw table dump. Not used by AnalyticsContainer. |
| `GET /api/query` | Duplicate of `POST /api/query`, curl-friendly. Frontend only uses POST. |
| `POST /api/tweets/by-ids` | Used by saved-queries snapshot rehydration only, which is itself out of scope for v1. |

If any of these become useful later, the recommended pattern is a script
under `packages/scripts/` (run via `sst shell tsx`), not a public Next.js
route — keeps the public surface minimal and avoids re-introducing M2M
auth concerns.

## Open questions / follow-ups

- **Saved queries**: out of scope for v1, but the UI hides the dropdown gracefully. Future story: add a `SavedQueries` table + 4 routes (`GET/POST/DELETE /api/saved-queries`, `GET /api/saved-queries/:id/snapshots`).
- **Cities5000 dataset license**: GeoNames cities5000 is CC-BY 4.0 — implementer must include attribution in `LICENSES.md` at the repo root when bundling.
- **OpenCage ToS re-confirmation**: ToS allowing permanent caching was correct as of last verification; implementer should reconfirm at build time before shipping.
- **Treemap as v1.1 enhancement**: `BioDomainsChart` ships as a bar list in v1. A real squarified treemap is a future enhancement if visual variety is requested.
- **GeoNames Web Service vs OpenCage**: if OpenCage's 2,500/day free tier proves insufficient for the actual production volume, GeoNames Web Service (30k/day free) is a drop-in alternative — same response shape mappers, same cache schema.
