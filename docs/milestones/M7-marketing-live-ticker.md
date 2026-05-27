# M7 — Marketing live ticker

Replaces the hardcoded `TICKER_DATA` in `packages/marketing/app/_components/LiveTicker.tsx` with real, live data served from an edge-cached public S3 snapshot. Solana tokens only, hour-over-hour buzz delta, click-through deep-links into signup.

## ClickUp tasks consolidated here

- Marketing Page ticker banner

## Locked decisions

- **Solana tokens only** (consistent with M6's GeckoTerminal choice — keeps the data pipeline single-track).
- **Public S3 snapshot behind CloudFront** as the delivery mechanism. Marketing fetches a same-origin JSON file; no cross-subdomain calls, no DB access from marketing (which is forbidden by the existing layering rules).
- **Buzz metric = hour-over-hour mentions delta**.
- **Click → `/signup?token=<SYM>`** deep-link captured by the app post-auth, routing the new user to that token's detail page.
- **Reuses** the M6 OHLCV cache for prices and the M1 Aggregates table for mentions counts. No new pricing logic.

## Phases

### Phase 1 — Snapshot Lambda + S3 bucket

- New `infra/ticker.ts` module. Public-read S3 bucket with `ticker.json` object, CloudFront-fronted at e.g. `tokenbuzz.app/static/ticker.json`.
- EventBridge schedule every 30s triggers a Lambda that:
  - Queries `Aggregates` for top 9 Solana tokens by mentions-last-hour
  - For each, calls `getOHLCV(symbol, '5m', last 2h)` to derive current price + 24h delta (reuses M6 cache)
  - Computes `buzzDelta` = `(mentions_lastHour - mentions_priorHour) / mentions_priorHour`
  - Writes `{ updatedAt, tokens: [{symbol, price, deltaPct, buzzDelta}] }` to S3 with `Cache-Control: max-age=30, s-maxage=30`

### Phase 2 — `LiveTicker` reads snapshot

- Update `packages/marketing/app/_components/LiveTicker.tsx`:
  - Server component does the initial SSR fetch from the CloudFront-fronted JSON URL
  - Client portion re-fetches every 30s, falls back to last-good snapshot on failure
  - Marquee animation + CSS unchanged (visual identity preserved)
  - Subtle "TRENDING" badge for items where `buzzDelta > 100%`

### Phase 3 — Click handler → signup with deep-link

- Wrap each ticker item in `<a href={'/signup?token=' + symbol}>`.
- App-side post-auth landing handler reads `?token=` and routes new users to `/watchlist?focus=<symbol>` (or the token's detail page).
- Pre-launch fallback: `/coming-soon?token=<SYM>` captures the interest in the waitlist.

### Phase 4 — Empty / error states

- `updatedAt` older than 5 min → subtle "data stale" indicator (e.g. pause the marquee).
- No snapshot yet (cold start) → render the existing hardcoded `TICKER_DATA` as fallback so the marketing page never visually breaks.

### Phase 5 — Cost guardrails

- 9 tokens refreshed every 30s — almost entirely absorbed by the M6 cache (cache-through with 5-min TTL on recent buckets), so GeckoTerminal calls stay far below its keyless 30 req/min free cap.
- DynamoDB atomic counter alarms if GeckoTerminal calls/min approach the free-tier cap (shared with M6 Phase 6's guardrail).

## Dependencies

- Requires M1 (aggregates for buzz counts) and M6 (`getOHLCV` cache for prices).
- Standalone on the marketing side — no shared UI dependencies with the application.
