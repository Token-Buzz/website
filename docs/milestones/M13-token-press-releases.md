# M13 — Token Press Releases

Attach a token project's official newsroom / press page as a link on the user's watchlist item and token detail pane, and watch its press feed for new releases — surfaced as a feed in the detail pane with opt-in per-token alerts. First-party announcements only; third-party coverage is M14.

## Locked decisions

- **Press = first-party** — the project's own newsroom/blog feed (the project's own voice). Third-party coverage is M14.
- **Project links on a `PROFILE` child item**, not columns on the hot `TOKEN#<SYM>/META` row that the poller and spike-materializer rewrite every few minutes. Keeps the GSI-projected META item small and avoids write contention.
- **One shared `Feeds` table** with a `kind ∈ {PRESS, NEWS}` discriminator — a deliberate, justified deviation from M9's per-source-table rule. M9 used per-source tables *because the record shapes differ* (subreddit vs channel vs server); press and news are structurally identical syndication entries (`{title, link, guid, publishedAt, summary, sourceName}`), differing only by ownership + relevance model. One table is the strongest possible reuse for M14, while still being a single new *source family* unified at `Aggregates` — which honors M9's actual principle.
- **`pressUrl` (human page) is always displayable; `pressFeedUrl` (RSS/Atom) gates auto-watch.** No feed → link still shown, auto-watch unavailable.
- **Watch behavior = both** — a passive feed in the detail pane *and* opt-in per-token alerts delivered through the existing M1 alerts inbox (`tone:'press'`).
- **Curated seed first, user-submitted second** — tokens are symbol-only (collision risk), so a checked-in curated seed map populates `PROFILE` feeds for the top ~50–100 symbols. User-submitted overrides are stored per-user on the watchlist item (never pollute the global PROFILE), with an optional promote/moderation step later.
- **Dedup without `since_id`** — RSS has no cursor. Two layers: (1) a `lastPublishedAt` high-water mark on a per-feed cursor row, (2) a stable `entryId = sha1(guid||link)` embedded in the sort key plus a conditional `PutItem attribute_not_exists` (idempotent, at-least-once-safe). HTTP conditional GET (ETag / Last-Modified) keeps most polls cheap 304s.

## Schema additions

```ts
// packages/core/src/db/keys.ts — new builders
tokenProfileKey(symbol)                      // pk=TOKEN#<SYM>          sk=PROFILE
feedItemKey(symbol, kind, isoTs, entryId)    // pk=FEED#<SYM>#<KIND>    sk=<ISO-ts>#<entryId>
feedTokenGsi(symbol, kind, isoTs, entryId)   // gsi1pk=FEED#<SYM>       gsi1sk=<KIND>#<ISO-ts>#<entryId>
feedGuidGsi(feedUrlHash, guidHash)           // gsi2pk=FEEDGUID#<hash>  gsi2sk=<guidHash>
feedSourceKey(symbol, kind, feedUrlHash)     // pk=FEEDSRC#<SYM>#<KIND> sk=SRC#<feedUrlHash>  (poll cursor)
watchlistBySymbolGsi(symbol, userId)         // gsi1pk=WATCHSYM#<SYM>   gsi1sk=USER#<userId> (on UserData)

// infra/db.ts — new `Feeds` table:
//   pk/sk + gsi1 (FeedByTokenKindTime) + gsi2 (FeedByGuid), stream: "new-and-old-images".
//   Add a gsi1 (WatchersBySymbol) to userDataTable.
// packages/core/src/db/client.ts — add `feeds` to the TableNames map.
// infra/jobs.ts — add feedsTable to `allTables` (client.ts eagerly reads every Resource.X.name).

// TokenProfileRecord: websiteUrl?, pressUrl?, pressFeedUrl?, newsKeywords?: string[] (M14),
//   githubUrl?, contractAddress?, chain?, source: 'seed' | 'user' | 'curated', updatedAt
// FeedItemRecord: symbol, kind, entryId, guid, link, title, summary?, sourceName,
//   feedUrlHash, publishedAt, ingestedAt (+ gsi keys)
// WatchlistItem  += pressAlerts?: boolean  (newsAlerts? added in M14)
// AlertItem.tone += 'press'                 ('news' added in M14)
```

## Phases

### Phase 1 — Schema + project-metadata data layer

- Add the new builders to `packages/core/src/db/keys.ts`.
- Declare the `Feeds` table (stream + 2 GSIs) in `infra/db.ts`; add it to `allTables` in `infra/jobs.ts` and to the `TableNames` map in `packages/core/src/db/client.ts` (these three move together or the job Lambdas crash at init).
- New `packages/core/src/db/feeds.ts` (`putFeedItem`, `getFeedItems`, `getFeedSourceCursor`, `upsertFeedSourceCursor`) and `packages/core/src/db/token-profile.ts` (`getTokenProfile`, `upsertTokenProfile`).
- Curated seed map (`symbol → { websiteUrl, pressUrl, pressFeedUrl }`) + an idempotent one-shot seeder.
- Unit tests for the key builders; a dynalite integration test for the feed write→read + cursor round-trip.

### Phase 2 — Links surfaced in UI (passive, no polling)

- `GET /api/tokens/:symbol/profile`.
- Wire the real watchlist read path — the detail pane currently renders SAMPLE data and M2's watchlist API routes don't exist yet (`getWatchlist`/`addToWatchlist` exist but aren't routed). This is a hard prerequisite.
- Add a "Links" block (website / newsroom / GitHub / contract) to `TokenDetailPane.tsx` below the stat strip.
- Browser UI test.

### Phase 3 — Press feed ingestion

- `packages/core/src/lib/feeds.ts` — `rss-parser` + HTTP conditional GET (mirrors `lib/twitter.ts` as the external-fetch boundary).
- `packages/jobs/src/feed-poller.ts` PRESS path (clone of `poller.ts`): enumerate tracked tokens, poll each `pressFeedUrl`, dedup (high-water + conditional put), write `FEED#<SYM>#PRESS` rows.
- `FeedPoller` cron (`rate(5 minutes)`) in `infra/jobs.ts`.
- "Recent press" feed section in `TokenDetailPane.tsx` reading `GET /api/tokens/:symbol/feed?kind=PRESS`.

### Phase 4 — Per-token press alerts (opt-in)

- Extend `WatchlistItem` with `pressAlerts?` and the `WatchersBySymbol` GSI on `userDataTable`; add `setWatchlistAlertPrefs()`.
- Wire the existing "Set alert" header button in `TokenDetailPane.tsx` to a press-alert toggle.
- `packages/jobs/src/feed-alerts.ts` stream consumer (`FeedAlertDispatcher`): on a new `FEED#` INSERT, query `WatchersBySymbol`, filter to opted-in users, fire `tone:'press'` alerts via `createAlert`. This is the M1-Phase-4 "rule evaluation in a streaming Lambda" pattern specialized.

### Phase 5 — Aggregation + polish + user-submitted links

- `packages/jobs/src/feed-aggregator.ts` (`FeedAggregator` stream consumer) writing `AGG#NEWS_VOLUME#<SYM>` counters (PRESS kind), reusing the `incrementCounter` pattern from `aggregator.ts`.
- User-submitted `pressUrlOverride` / `pressFeedUrlOverride` on the watchlist item, with read precedence user → PROFILE.
- Dead-feed error surfacing (`errorCount` on the cursor row).

## Dependencies

- Requires M1 (the ingestion → aggregate → alert pipeline this extends) and M2 (the watchlist data path + detail pane — note its API routes are not built yet; Phase 2 wires them).
- Couples with M5 (tier-gating; press RSS is free → available to all tiers).
- Follows M9's source-family / unify-at-`Aggregates` principle.
- **Must land before M14**, which reuses every shared artifact built here.

## Risks / open questions

- **Symbol→project→feed mapping (highest risk)** — symbols collide (ticker reuse across chains). Mitigate with a curated seed (not auto-discovery) and by capturing `contractAddress` + `chain` in PROFILE to disambiguate.
- **Feed discovery** — many projects publish a newsroom page but no advertised RSS. `pressUrl` is shown even without a feed; auto-watch is simply unavailable. Best-effort `<link rel="alternate">` autodiscovery during seeding, treated as candidates for human review.
- **`allTables` eager-link footgun** — `client.ts` reads every `Resource.X.name` at module load, so a new table must be linked to every job Lambda. Update `db.ts`, `jobs.ts`, and `client.ts` together.
- **Legal / ToS** — store only title + short summary + link; deep-link to the source. Press feeds are first-party (the project wants distribution).
- **Feed reliability** — bad/missing `pubDate`, duplicate guids, republished old items. Mitigated by the two-layer dedup + a rolling `lastSeenGuids` window + `errorCount`.
