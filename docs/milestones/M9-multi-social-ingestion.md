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
- **Tier-gated by API economics** — cheapest in Free, paid/operationally-heavy APIs gated:
  - Free: X (fixed-cost subscription, scale-friendly) + Farcaster (free + free)
  - Pro: + Reddit ($0.24/1k calls — variable cost, gate to recover spend)
  - Alpha: + Telegram + Discord (operationally heavy — premium tier)

## Per-source assessment

| Source | Crypto signal | API access | Cost | Verdict |
| --- | --- | --- | --- | --- |
| Telegram | ★★★★★ | MTProto user API | Free + operational | Phase 4 |
| Reddit | ★★★★ | Official paid API | ~$0.24/1k calls | Phase 3 |
| Discord | ★★★★ | Bot API, server-invited | Free + per-server onboarding | Phase 5 |
| Farcaster | ★★★ | Open API (Neynar/Pinata free tier) | Free | Phase 2 (first integration) |
| TikTok | ★★ | Research API academics-only | No general access | Deferred |
| Instagram | ★ | Graph API doesn't expose search | – | Skipped |
| Facebook | ½★ | Graph API doesn't expose groups | – | Skipped |

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

### Phase 1 — Source-agnostic query layer

- Refactor the Analytics ingestion API to accept `sources[]` parameter.
- Each query fan-outs to per-source Lambdas in parallel; results unified at the aggregate level.
- UI gets source-filter chips: `[X (87)] [Reddit (23)] [Telegram (12)]`.

### Phase 2 — Farcaster ingestor (free, lowest-risk first integration)

- Neynar or Pinata API for casts matching a query.
- Free tier covers v1 volume.
- Lowest-risk integration to prove the multi-source plumbing without paying per-call costs or maintaining a user account.

### Phase 3 — Reddit ingestor

- Official paid API. Two ingestion paths:
  - Live search for new posts matching query
  - Per-subreddit top-of-hour polling for designated crypto subs (r/CryptoCurrency, r/SolanaMemecoins, r/SatoshiStreetBets, token-specific subs)
- Gate to Pro tier.
- Meter Reddit calls against a new monthly counter `USAGE#<yyyymm>#reddit` (extends M5's entitlement layer).

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

### Phase 7 — TikTok / IG / FB

- TikTok deferred indefinitely until/unless the Research API opens up.
- IG and FB skipped — low crypto signal, no good API path.

## Dependencies

- Requires M1 (the ingestion + aggregation pipeline this extends).
- Couples with M5 (per-source quota enforcement via new `USAGE#...` counter rows).
- Naturally extends M8 — saved queries become multi-source, with source-filter chips re-rendering historical snapshots per-source.
