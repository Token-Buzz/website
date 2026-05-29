# M9 — Multi-Social Ingestion (v2)

Expands ingestion beyond X/Twitter to crypto-native social platforms. Reorders the original ClickUp list (Reddit / IG / FB / TikTok) to reflect actual crypto-relevance: Telegram and Farcaster are higher-signal than IG/FB/TikTok for crypto. IG and FB are skipped; TikTok is deferred indefinitely.

## ClickUp tasks consolidated here

- More social media sources, which APIs are available and low-cost / free? (parent)
- Reddit (subtask)
- Instagram (subtask) — skipped (low crypto signal)
- Facebook (subtask) — skipped (low crypto signal)
- TikTok (subtask) — deferred (no general API access)

## Locked decisions

- **v2 milestone** — does not block v1 ship.
- **Source priority**: Telegram → Reddit → Discord → Farcaster. Skip IG/FB; defer TikTok.
- **Per-source tables** (one new DDB table per platform). Existing `Tweets` table untouched. All sources unify only at the source-agnostic `Aggregates` table.
- **Two ingestion modes for every source — manual *and* automated.** Mirrors the existing X/Twitter design: a user can run an on-demand search, *and* can opt into automated monitoring (polling) of a query. Automated monitoring is a **first-class part of the source-agnostic layer (Phase 1)**, not a bolt-on — see "Ingestion modes" below.
- **Tier-gated by API economics** — cheapest in Free, paid/operationally-heavy APIs gated:
  - Free: X (BYOK — user's twitterapi.io key) + Farcaster (free + free) + **Reddit (BYOK — user's own Reddit app credentials)**
  - Alpha: + Telegram + Discord (operationally heavy — premium tier)
- **Reddit pivoted to BYOK (Nov 2025).** Reddit ended self-service API keys and gates commercial use behind manual approval (Responsible Builder Policy), so the project can't hold one shared paid credential. Reddit is now a **per-user BYOK provider** (exactly like the X/twitterapi.io key): each user supplies their own Reddit app `client_id` + `client_secret`, uses their own quota, and bears their own cost. This removes the original Pro-gate + project-side metering rationale — Reddit is **Free-tier** like the other BYOK sources, with **no project quota/`USAGE#…#reddit` counter**. The in-client rate-limit throttle (Retry-After/`X-Ratelimit`) stays.

## Ingestion modes — manual + automated (mirrors X/Twitter)

The existing Twitter pipeline already supports **both** modes, and M9 carries both forward to every new source:

- **Manual (on-demand search)** — user submits a query in the Analytics UI; results fetched and persisted immediately. Today: `POST /api/query` → `searchTweets()`.
- **Automated monitoring (opt-in polling)** — user sets up a monitor on a query; a scheduled Lambda re-runs it on an interval and persists new results. Today: `TweetPoller` cron (`infra/jobs.ts`, `rate(2 minutes)`, prod-only) → `getPollAssignments()` finds users with `backgroundPolling === true`, pulls their watchlist queries via `getAllTrackedQueries()`, fetches since the last seen id.

**Design rule for M9:** generalize the Twitter-specific poller into a **source-agnostic "monitor" abstraction** — `{ query, sources[], interval }` opt-in per user — with a per-source adapter behind it. Do this once in Phase 1 rather than re-implementing polling four times. Reuse what already exists:

- **Watchlist / tracked-query model** (`packages/core/src/db/user-data.ts`, `getAllTrackedQueries`) — already stores per-user query lists.
- **Poll-assignment + dedup logic** (`packages/core/src/db/byok-poll.ts`) — already fans out across users/queries and avoids double-polling the same query.
- **DynamoDB Streams consumers** (Aggregator, Sentiment, AlertEvaluator) — fire automatically on every persisted record regardless of whether it came from a manual search or a poll, so per-source records flow into Aggregates with no extra wiring.

### Poll cadence policy (cost control)

Polling multiplies call volume, so cadence is gated by each source's cost model:

- **Free / zero-marginal-cost sources** (X fixed-subscription, Farcaster free tier) — may poll at the existing ~2-minute cadence.
- **Paid-per-call sources** (Reddit) — default to a **coarser interval (≈15–30 min)** and **count every poll call against the monthly per-source quota** (`USAGE#<yyyymm>#reddit`). Polling auto-pauses when the quota is exhausted.
- **Operationally-heavy sources** (Telegram, Discord) — cadence bounded by platform rate limits / `FLOOD_WAIT`, not by dollars; conservative defaults to protect the shared project account/bot.

## API cost & free-tier findings (researched 2026-05)

Paid rates for the closed APIs move around and several require sales contact, so treat dollar figures as ballpark.

| Source | Free tier | Paid cost | Notes |
| --- | --- | --- | --- |
| **Farcaster (Neynar)** | **Yes** — free tier exists; Starter-level limits ≈300 RPM / 5 RPS per endpoint. | Credit / compute-unit based (historically a ~$9 Starter plan; pay-as-you-go x402 endpoints). | Genuinely free to start → best first integration (Phase 2). |
| **Reddit** | 100 QPM authenticated (OAuth); 10 RPM unauthenticated. Non-commercial only. | **~$0.24 / 1,000 calls** at volume; **no public rate card** — commercial/serious use requires enterprise sales + use-case review for a custom quote. | Only source with a real per-call dollar cost *and* a commercial-licensing wrinkle → gate to Pro, meter via `USAGE#<yyyymm>#reddit`. |
| **Telegram (MTProto)** | **Free** — no per-call charge. | Free; cost is operational (undocumented `FLOOD_WAIT` limits, account-ban risk, session storage). | Alpha. Dollar cost ≈ $0; engineering/ops cost is the gate. |
| **Discord** | **Free** (Bot API). | Free; cost is per-server manual bot-invite onboarding. | Alpha. Dollar cost ≈ $0; onboarding effort is the gate. |
| **TikTok** | Research API, academics-only — no general access. | — | Deferred. |
| **Instagram / Facebook** | Graph API exposes neither search nor groups. | — | Skipped. |

**Takeaways:** Farcaster + Telegram + Discord are effectively **$0 in API fees** (Telegram/Discord cost is operational). **Reddit is the only real per-call dollar cost** — which is exactly why it's Pro-gated and metered, and why its automated monitoring uses a coarser default interval.

## Per-source assessment

| Source | Crypto signal | API access | Cost | Verdict |
| --- | --- | --- | --- | --- |
| Telegram | ★★★★★ | MTProto user API | Free + operational | Phase 4 |
| Reddit | ★★★★ | Official paid API | ~$0.24/1k calls | Phase 3 |
| Discord | ★★★★ | Bot API, server-invited | Free + per-server onboarding | Phase 5 |
| Farcaster | ★★★ | Open API (Neynar/Pinata free tier) | Free | Phase 2 (first integration) |
| TikTok | ★★ | Research API academics-only | No general access | Won't implement (Phase 7 closed) |
| Instagram | ★ | Graph API doesn't expose search | – | Won't implement (Phase 7 closed) |
| Facebook | ½★ | Graph API doesn't expose groups | – | Won't implement (Phase 7 closed) |

## Schema additions

```ts
// New tables in infra/db.ts
RedditPosts        — pk: SUB#<subreddit>, sk: POST#<timestamp>#<id>
TelegramMessages   — pk: CHAN#<channelHandle>, sk: MSG#<timestamp>#<id>
DiscordMessages    — pk: SERVER#<serverId>, sk: MSG#<timestamp>#<id>
FarcasterCasts     — pk: CHANNEL#<channelId>, sk: CAST#<timestamp>#<id>
```

Each source-specific table has its own GSIs sized to the platform's natural access patterns (e.g. Reddit by subreddit + timestamp, Telegram by channel + timestamp).

## Phases

### Phase 1 — Source-agnostic query layer (manual + automated)

- Refactor the Analytics ingestion API to accept `sources[]` parameter.
- Each query fan-outs to per-source Lambdas in parallel; results unified at the aggregate level.
- **Generalize the Twitter-specific `TweetPoller` into a source-agnostic monitor:** a `{ query, sources[], interval }` opt-in record per user, with a per-source adapter behind a common interface. The scheduled Lambda iterates monitors and dispatches each source via its adapter — so both manual search and automated polling share the same per-source ingestor code. Build this once here, not per source.
- UI gets source-filter chips: `[X (87)] [Reddit (23)] [Telegram (12)]`.

### Phase 2 — Farcaster ingestor (free, lowest-risk first integration)

- Neynar or Pinata API for casts matching a query.
- Free tier covers v1 volume.
- Lowest-risk integration to prove the multi-source plumbing without paying per-call costs or maintaining a user account.

### Phase 3 — Reddit ingestor (per-user BYOK)

Reddit's official API ended self-service keys (Nov 2025) and gates commercial use behind manual approval, so Reddit ships as a **per-user BYOK provider** — modeled on the existing X/twitterapi.io key, not on a project-held credential.

- **Credentials:** each user creates their own Reddit "script" app and supplies its `client_id` + `client_secret` in Account → API Keys. Stored encrypted in the `UserData` BYOK slot (combined as a JSON credential), validated on entry via an app-only OAuth token fetch. The provider registry (`providers.ts`) gains `reddit`; the Account UI is now a registry-driven tabbed multi-provider section.
- **Two ingestion paths** (same as X): **manual** live search, and **automated** monitoring via the Phase 1 monitor on a coarse default interval (~20 min). Reddit flows through the generic BYOK path in the `/api/query` route and the monitor poller — no source-specific special-casing.
- **Free tier**, no project quota/metering (the user's own Reddit app quota — 100 QPM — is the limit). The client is a good API citizen: per-credential token cache, `Retry-After`/`X-Ratelimit` aware backoff + proactive throttle.
- Client uses app-only OAuth (`client_credentials`) against `oauth.reddit.com/search`. No project `REDDIT_CLIENT_ID/SECRET` secret — pure BYOK.

### Phase 4 — Telegram ingestor

- MTProto user-account-as-bot. Maintain a project-owned Telegram account that joins/observes a curated list of crypto channels.
- Channels are public broadcast — ingest messages matching queries.
- Real operational complexity: account ban risk, session storage, rate limits.
- Gate to Alpha.

### Phase 5 — Discord ingestor

- Verified bot deployed to crypto-community servers that opt in. Server admins invite the bot.
- Indexes messages matching queries with admin consent.
- Gate to Alpha.
- Operational onboarding: each server is a manual invite.

### Phase 6 — UI: source filter chips + per-source quotas

- Analytics page shows `[All] [X 87] [Reddit 23] [Telegram 12]`. Each filter restricts the aggregate cards to that source.
- Per-source quota counters surface in Account → Plan & Billing.

### Phase 7 — TikTok / IG / FB — **WON'T IMPLEMENT (closed)**

Decided **2026-05**: TikTok, Instagram, and Facebook will **not** be implemented — not via a direct API and not via Apify. The phase is closed.

- TikTok — no general API access (Research API is academics-only); low priority relative to crypto-native sources.
- IG / FB — low crypto signal, and the Graph API exposes neither search nor groups.
- These were briefly reconsidered as "Apify-only" sources during Phase 8 design (Apify has mature actors for all three), but the call is to **not** ship them: the added actor adapters, normalizers, and per-source tables aren't worth it for the weak crypto signal. Apify mode (Phase 8) therefore covers only the same sources as direct mode.

### Phase 8 — Apify "all-in-one" BYOK ingestion mode

A master alternative to per-source keys: instead of connecting a separate credential for every platform, a user supplies **one Apify API token** and TokenBuzz drives each source through Apify **Actors** (pre-built scrapers) using that single token. Pure BYOK — the user pays Apify directly (per compute unit / per result); no project quota or metering.

**Why this fits M9 cleanly:** Phase 1 already mandates a per-source adapter behind a common interface. Apify is simply a **second implementation** of each source adapter (`ApifyXAdapter` alongside the direct `XAdapter`, etc.). The user's mode setting selects which implementation runs for a given source — no new ingestion abstraction is introduced.

**Scope of sources:** parity with direct mode only — **X, Reddit, Farcaster, Telegram, Discord**. No TikTok/IG/FB (see Phase 7). Each source maps to a specific Apify actor (e.g. an X/tweet-scraper, a Reddit scraper, etc.) via a small registry; each actor has its own input schema and output shape, so each gets a thin **normalizer** mapping its dataset rows into the existing per-source table records → `Aggregates`.

**Mode model — global default + per-source override:**
- A per-user **ingestion mode** setting with a **global default** of `per-source` (existing behavior; nothing changes for current users) or `apify`.
- **Per-source override:** a user can pin an individual source to the other mode (e.g. global `apify`, but keep X on the direct twitterapi.io key). Resolution is: per-source override if set, else the global default.
- Stored in `UserData` (e.g. `SETTINGS#ingestion` holding `{ default, overrides: { <source>: 'per-source' | 'apify' } }`). The Apify token itself stores in the existing encrypted BYOK slot as `BYOK#apify` — same KMS-encrypted pattern as every other BYOK credential, validated on entry (e.g. an Apify `GET /v2/users/me` call with the token).

**Sync vs async execution (the one real architectural difference):**
- Direct APIs are synchronous (one request returns results). **Apify actor runs are asynchronous** — start a run, wait seconds-to-minutes, then fetch the dataset.
- **Manual search:** use Apify's `run-sync-get-dataset-items` endpoint with a tight timeout cap; if a run exceeds the cap, return partial/queued rather than blocking the request.
- **Automated monitoring:** async — the Phase 1 monitor poller starts an actor run and an **Apify webhook** calls back an ingest Lambda when the dataset is ready. (Async actually fits polling *better* than synchronous APIs.)

**UI (extends the existing tabbed API Keys section):**
- A segmented control at the top of the API Keys tab: **`[ Per-source keys ] [ Apify ]`**.
  - **Per-source keys** → the existing registry-driven tabbed section (X / Reddit / …), unchanged.
  - **Apify** → a single Apify-token entry/status panel, plus a checklist of the sources Apify will cover, each with a small per-source mode toggle (the override).
- The segmented control sets the **global default**; the per-source toggles set overrides.

**Cost awareness:** Apify runs can be expensive and it's the user's own account, so surface a short cost-model note in the Apify panel (links to Apify pricing). No project-side metering — the user's Apify plan is the limit.

**Tasks (rough):**
- `providers.ts`: add `apify` to the BYOK provider registry; `providerMeta.ts`: Apify token field + setup instructions.
- Ingestion-mode setting: `UserData` key builder + read/write helpers + dynalite integration test for the round-trip.
- Mode resolver: given (user, source) → `'per-source' | 'apify'`, honoring override-then-default. Pure logic → unit-tested.
- Apify client: token validation, `run-sync-get-dataset-items` for manual, async run + webhook for monitoring.
- Per-source actor registry + normalizers (one per source: X, Reddit, Farcaster, Telegram, Discord), each with the actor id, input mapping, and dataset→record mapping. Normalizers are pure → unit-tested.
- Wire the resolver into `/api/query` dispatch and the Phase 1 monitor poller so each source picks its adapter implementation by resolved mode.
- UI: segmented mode control + Apify panel + per-source override toggles; real browser UI test of the switch.

**Dependencies:** Phase 1 (the source-agnostic adapter interface this plugs a second implementation into) and the M10 BYOK encryption/storage pattern (this reuses it wholesale).

## Dependencies

- Requires M1 (the ingestion + aggregation pipeline this extends).
- Couples with M5 (per-source quota enforcement via new `USAGE#...` counter rows).
- Naturally extends M8 — saved queries become multi-source, with source-filter chips re-rendering historical snapshots per-source.
