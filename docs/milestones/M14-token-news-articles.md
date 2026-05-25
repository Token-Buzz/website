# M14 — Token News & Articles

Aggregate third-party news, articles, and blog posts about a token from free RSS feeds and free-tier crypto news APIs — no scraping, no social media — surfaced on the token detail pane with opt-in per-token alerts. Reuses M13's feed plumbing end-to-end.

## Locked decisions

- **Third-party coverage** — outlets and bloggers writing *about* the token, distinct from M13's first-party press.
- **Sourcing = free RSS + free-tier APIs** — RSS from CoinDesk, CoinTelegraph, Decrypt, The Block, plus free-tier APIs (CryptoPanic `?currencies=`, CryptoCompare news). No web scraping; no social-media sources.
- **Reuses the M13 `Feeds` table** as `kind=NEWS` rows — no new table.
- **Relevance by keyword/alias match** against `PROFILE.newsKeywords` with a tunable `relevanceScore` threshold; an article can match multiple tokens → one `FEED#<SYM>#NEWS` row per matched token (fan-out). Optional Bedrock relevance/sentiment later, tier-gated.
- **News firehose pulled once per cycle, then fanned out by relevance** — never per-token API calls — to respect free-tier quotas.

## Schema additions

```ts
// No new table — reuses the M13 `Feeds` table + all M13 keys.ts builders + db/feeds.ts.

// TokenProfileRecord += newsKeywords?: string[]   // relevance terms, e.g. ["Pepe","$PEPE","pepe coin"]
// WatchlistItem      += newsAlerts?: boolean
// AlertItem.tone     += 'news'

// infra/secrets.ts — new secrets:
CRYPTOPANIC_API_KEY
CRYPTOCOMPARE_API_KEY

// New aggregate types (open `type` enum consumed by readAggregateTopK):
AGG#NEWS_SOURCE#<SYM>   // BUCKET#<hour>#<sourceName>  — top outlets covering a token (Top-K)
AGG#NEWS_VOLUME#<SYM>   // BUCKET#<hour>#<kind>        — press vs news coverage volume
```

## Phases

### Phase 1 — News sourcing config + relevance keywords

- Reuses the M13 schema entirely. Add `newsKeywords` to the `PROFILE` item and seed them for the curated symbols.
- Declare `CRYPTOPANIC_API_KEY` and `CRYPTOCOMPARE_API_KEY` in `infra/secrets.ts`.
- Checked-in list of outlet RSS URLs (CoinDesk / CoinTelegraph / Decrypt / The Block).

### Phase 2 — News ingestion + relevance fan-out

- Reuses the `feed-poller.ts` skeleton + `lib/feeds.ts` + the dedup/cursor logic from M13 Phase 3.
- Add the NEWS path: one consolidated pull per cycle of outlet RSS + CryptoPanic (`?currencies=`) + CryptoCompare news, then relevance-match each entry against `newsKeywords` and fan it to the matching `FEED#<SYM>#NEWS` rows.
- New `packages/core/src/lib/cryptopanic.ts` and `packages/core/src/lib/cryptocompare.ts` fetch wrappers (mirror `lib/twitter.ts`).

### Phase 3 — News feed UI

- Reuses the M13 detail-pane feed section, now with a PRESS / NEWS toggle (or two sections), reading `?kind=NEWS`.
- News card shows outlet name + relevance.
- Optional movers/feed context ("tokens in the news").

### Phase 4 — Per-token news alerts (opt-in)

- Reuses the entire M13 `FeedAlertDispatcher` / `WatchersBySymbol` / `AlertItem` path.
- Add `newsAlerts?` to `WatchlistItem`; the dispatcher already fires by `kind` — just route `tone:'news'`. Same toggle UI pattern.

### Phase 5 — News aggregation + optional AI relevance/sentiment

- Reuses `feed-aggregator.ts`. Add `AGG#NEWS_SOURCE#<SYM>` (top outlets, Top-K via `readAggregateTopK(type:'NEWS_SOURCE')`) and the NEWS `AGG#NEWS_VOLUME` dimension.
- Optional v2: a `FeedSentimentDispatcher` stream consumer (Bedrock Haiku, scoped IAM like `SentimentDispatcher`) for article relevance + sentiment, tier-gated per M5.

## Dependencies

- Requires M13 (every shared artifact: the `Feeds` table, `db/feeds.ts`, the poller skeleton, the detail-pane feed component, the alert dispatcher, the `WatchersBySymbol` GSI), plus M1 and M2.
- Couples with M5 — free-tier API calls and any Bedrock classification are metered via `USAGE#<yyyymm>#feeds` counters (extends M9's per-source metering).
- **M14 adds essentially no new infrastructure** beyond the external-API fetch wrappers and the relevance fan-out branch.

## Risks / open questions

- **News relevance precision on short tickers** (`$ID`, `$OP`, `$SOL`) — require a project-name or `$`-prefixed match, a multi-keyword `relevanceScore` threshold, and reserve Bedrock classification for ambiguous short tickers (tier-gated). Make the threshold tunable.
- **Free-API rate limits / cost** — consolidated firehose pull per cycle (not per token), HTTP conditional GET on RSS, metering via `USAGE#<yyyymm>#feeds`, 5-minute cadence. Confirm current free-tier quotas before Phase 2.
- **Legal / ToS per outlet** — store only title + short summary + link; deep-link to the source; legal review before adding each NEWS source.
- **Aggregates at-least-once inflation** — stream-driven counters may slightly over-count (same caveat the repo already accepts for `aggregator.ts`); the conditional-put keeps the feed items themselves exact.
