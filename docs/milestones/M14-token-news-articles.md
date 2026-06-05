# M14 — Token News & Articles

Aggregate third-party news, articles, and blog posts about a token from free RSS feeds and free-tier crypto news APIs — no scraping, no social media — surfaced on the token detail pane with opt-in per-token alerts. Reuses M13's feed plumbing end-to-end.

## Locked decisions

- **Third-party coverage** — outlets and bloggers writing *about* the token, distinct from M13's first-party press.
- **Sourcing = free RSS + per-user BYOK APIs** — RSS from CoinDesk, CoinTelegraph, Decrypt, The Block is public/keyless. NewsData.io (crypto news endpoint `GET https://newsdata.io/api/1/crypto?apikey=pub_...`) and CryptoCompare news are free-tier APIs where **each user supplies their own API key** (entered in the Account → API Keys → News Aggregates tab). No web scraping; no social-media sources.
- **News API keys follow the M10 BYOK model** — KMS-encrypted in the `UserData` table under `BYOK#newsdata` / `BYOK#cryptocompare`, using a new `category: 'news'` field in the provider registry. These are **not** project `sst.Secret`s; there is no project-side API key and no project metering for these two APIs. Quota is per-user (the user's own free-tier account).
- **Reuses the M13 `Feeds` table** as `kind=NEWS` rows — no new table.
- **Relevance by keyword/alias match** against `PROFILE.newsKeywords` with a tunable `relevanceScore` threshold; an article can match multiple tokens → one `FEED#<SYM>#NEWS` row per matched token (fan-out). Optional Bedrock relevance/sentiment later, tier-gated.
- **News firehose pulled once per cycle, then fanned out by relevance** — never per-token API calls — to respect free-tier quotas.

## Schema additions

```ts
// No new table — reuses the M13 `Feeds` table + all M13 keys.ts builders + db/feeds.ts.

// TokenProfileRecord += newsKeywords?: string[]   // relevance terms, e.g. ["Pepe","$PEPE","pepe coin"]
// WatchlistItem      += newsAlerts?: boolean
// AlertItem.tone     += 'news'

// packages/core/src/providers.ts — BYOK additions (no infra/secrets.ts changes):
//   ProviderId     += 'newsdata' | 'cryptocompare'
//   ByokProvider   += category: 'social' | 'apify' | 'news'   // new field on the provider registry
//   PROVIDERS      += newsdata: { id: 'newsdata', name: 'NewsData.io', category: 'news', enabled: true }
//                    cryptocompare: { id: 'cryptocompare', name: 'CryptoCompare', category: 'news', enabled: true }
// UserData row: BYOK#newsdata / BYOK#cryptocompare  (same KMS-encrypted shape as all other BYOK providers)

// New aggregate types (open `type` enum consumed by readAggregateTopK):
AGG#NEWS_SOURCE#<SYM>   // BUCKET#<hour>#<sourceName>  — top outlets covering a token (Top-K)
AGG#NEWS_VOLUME#<SYM>   // BUCKET#<hour>#<kind>        — press vs news coverage volume
```

## Phases

### Phase 1 — News sourcing config + relevance keywords

- Reuses the M13 schema entirely. Add `newsKeywords` to the `PROFILE` item and seed them for the curated symbols.
- Add `newsdata` and `cryptocompare` BYOK providers to `packages/core/src/providers.ts`: extend `ProviderId`, add `category: 'news'` field to `ByokProvider`, register both providers.
- New validation client modules `packages/core/src/lib/newsdata.ts` and `packages/core/src/lib/cryptocompare.ts` (probe-key functions used by the Account UI on save).
- New **"News Aggregates"** tab/segment in the Account → API Keys UI, alongside the existing "Per-source keys" and "Apify" segments. Users enter and validate their NewsData.io / CryptoCompare API keys here; keys are shown as •••• last4, removable, with a background-polling opt-in (same pattern as other BYOK providers).
- Checked-in list of outlet RSS URLs in `packages/core/src/db/news-outlets.ts` (CoinDesk / CoinTelegraph / Decrypt / The Block) — public/keyless, no BYOK needed.

### Phase 2 — News ingestion + relevance fan-out

- Reuses the `feed-poller.ts` skeleton + `lib/feeds.ts` + the dedup/cursor logic from M13 Phase 3.
- Add the NEWS path: one consolidated pull per cycle of outlet RSS + NewsData.io crypto endpoint (`/crypto?apikey=pub_...`) + CryptoCompare news, then relevance-match each entry against `newsKeywords` and fan it to the matching `FEED#<SYM>#NEWS` rows.
- NewsData.io and CryptoCompare keys are resolved **per-user** via the BYOK resolver (`getByokKey(userId, provider)` / `getPollAssignments('newsdata')` / `getPollAssignments('cryptocompare')`) — the same pattern used by the social pollers. There is no project-wide key for either API.
- `packages/core/src/lib/newsdata.ts` and `packages/core/src/lib/cryptocompare.ts` gain their news-fetch wrappers on top of the Phase 1 validation clients (mirror `lib/twitter.ts`).
- Public outlet RSS feeds remain keyless — no BYOK resolver needed for that path.

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
- Couples with M5 for any optional Bedrock classification (sentiment, tier-gated). **NewsData.io and CryptoCompare are pure BYOK** — no project metering for these two APIs (users pay against their own free-tier quota, mirroring Reddit/Apify BYOK). RSS is keyless and has no quota impact.
- **M14 adds essentially no new infrastructure** beyond the BYOK provider registry entries, validation client modules, the Account UI tab, and the relevance fan-out branch.

## Risks / open questions

- **News relevance precision on short tickers** (`$ID`, `$OP`, `$SOL`) — require a project-name or `$`-prefixed match, a multi-keyword `relevanceScore` threshold, and reserve Bedrock classification for ambiguous short tickers (tier-gated). Make the threshold tunable.
- **Free-API rate limits / cost** — NewsData.io and CryptoCompare quota is per-user (BYOK); no project metering for these two APIs. NewsData.io free tier delivers ~200 credits/day (≈2,000 articles/day) with news ~12h delayed — acceptable for headline aggregation. RSS uses HTTP conditional GET + 5-minute cadence — confirm RSS feed update frequency before Phase 2. Confirm each user's current free-tier API quotas (NewsData.io/CryptoCompare) when onboarding.
- **CryptoPanic discontinued; CoinGecko news is paid** — CryptoPanic's free developer API was removed in April 2026 and is no longer available. CoinGecko's news endpoint requires a paid plan. NewsData.io was selected as the replacement free-tier crypto news API (verified free tier, no credit card required).
- **Legal / ToS per outlet** — store only title + short summary + link; deep-link to the source; legal review before adding each NEWS source.
- **Aggregates at-least-once inflation** — stream-driven counters may slightly over-count (same caveat the repo already accepts for `aggregator.ts`); the conditional-put keeps the feed items themselves exact.
