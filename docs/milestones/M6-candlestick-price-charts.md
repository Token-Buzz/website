# M6 — Candlestick + Price Charts

Real candle charts with social-event overlays — the unique angle vs. every other charting tool. Replaces the existing hand-rolled SVG sparkline on the token detail page and fills the M2 candlestick card type.

> **Provider rewrite (2026-05-27):** v1 originally specced **Birdeye** as the price provider. We dropped Birdeye in favour of **free, keyless** sources after researching the free Solana data landscape (see "Provider research" at the bottom). The cache-through architecture and the `PriceProvider` interface are unchanged — only the concrete provider changed — so this was a provider swap, not a redesign.

## Locked decisions

- **GeckoTerminal API (CoinGecko on-chain DEX data) as the v1 OHLCV provider** — free, **no API key**, covers arbitrary Solana DEX pools (memecoins included), real OHLCV at exactly 5m/1h/4h/1d, commercial use permitted (attribution appreciated, not mandated). 30 req/min on the free tier, which our cache-through layer absorbs.
- **Cache-through DynamoDB caching with TTL** — first request hits GeckoTerminal, writes candles to DDB with a TTL, subsequent requests within TTL hit DDB only.
- **TradingView Lightweight Charts** (Apache 2.0) as the rendering library.
- **Real-time = polling + a Jupiter live-price tick, NOT websocket streaming.** Free, true websocket streaming of *arbitrary* Solana memecoins does not exist (every arbitrary-coverage stream is paid, commercially barred on its free tier, or hands you raw swaps to decode — see research). So: the chart **polls** the latest candle on an interval, and a live last-price tick comes from **Jupiter Price API v3** (free, keyless, any SPL mint). True Pyth websocket streaming is a possible later upgrade but only covers curated blue-chips, so it's out of v1.
- **Social overlays IN v1** — sentiment spikes, mention bursts, KOL posts overlaid as markers on the candle chart. This is the differentiator.
- **Single `PriceProvider` interface** — so a second OHLCV provider (DexPaprika, Moralis) can slot in later without rewriting the cache layer or UI. v1 ships GeckoTerminal-only behind the interface.

## Addressing model (ticker → pool)

GeckoTerminal addresses OHLCV **by DEX pool address**, not by token mint. So resolution is `ticker → { mint, pool }`:

- `resolve(symbol)` calls GeckoTerminal `GET /search/pools?query=<symbol>&network=solana`, picks the pool with the highest `reserve_in_usd` (deepest liquidity), and extracts the pool address + base-token mint.
- The result is cached as a `TokenRef` row (`TOKEN#<SYM>#REF`) so we resolve once per symbol. The `mint` is retained for the Jupiter live-price tick (which addresses by mint); the `pool` is what OHLCV queries use.

## TTL strategy

- Recent buckets (≤1h old): TTL = 5 min so they refresh on the next request.
- Historical buckets (>1h old): immutable, no TTL.

## Schema additions

```ts
// secrets
// (none — GeckoTerminal and Jupiter are both keyless. The BIRDEYE_API_KEY
//  secret from the original spec was removed.)

// Tokens table — cached OHLCV rows (unchanged from original spec)
ohlcvKey(symbol, interval, ts) => {
  pk: `TOKEN#${symbol}`,
  sk: `OHLCV#${interval}#${ts}`,   // ts zero-padded for numeric range scans
}
// attrs: { ts, open, high, low, close, volume, ttl? }

// Tokens table — symbol → on-chain resolution cache (mint + pool)
tokenRefKey(symbol) => {
  pk: `TOKEN#${symbol}`,
  sk: 'REF',
}
// attrs: { symbol, mint, pool, chain, source }
```

`infra/db.ts`: the `Tokens` table has `ttl: "ttl"` enabled (TTL only deletes rows that carry the `ttl` attribute, so existing META/FOLLOWER rows are unaffected).

## Phases

### Phase 1 — GeckoTerminal provider + cache-through API

- `packages/core/src/providers/price.ts` — the `PriceProvider` interface (`resolve` + `fetchOHLCV`), `TokenRef`/`OHLCVBar`/`PriceInterval` types, and the pure helpers (`INTERVAL_SECONDS`, `expectedBuckets`, `missingBuckets`, `ttlForBucket`).
- `packages/core/src/providers/geckoterminal.ts` — keyless `PriceProvider` impl: `resolve` via `/search/pools`, `fetchOHLCV` via `/networks/solana/pools/{pool}/ohlcv/{timeframe}?aggregate=&limit=&before_timestamp=`. Interval → (timeframe, aggregate): `5m→(minute,5)`, `1h→(hour,1)`, `4h→(hour,4)`, `1d→(day,1)`.
- `ticker → pool` resolution cached at `TOKEN#<sym>#REF`.
- Core function `getOHLCV(symbol, interval, from, to)`: queries DDB for cached buckets, fetches gaps from GeckoTerminal, writes back with TTL, returns merged; degrades to cached data on provider error.
- API route `GET /api/price/[symbol]?interval=5m&from=...&to=...` (Clerk-authed).
- All behind the `PriceProvider` interface for a future provider swap.

### Phase 2 — `<CandleChart>` component

- Built on `lightweight-charts`.
- Props `{ symbol, interval, height? }`.
- Fetches `/api/price/[symbol]`, renders candle series + volume bar series, crosshair tooltip with OHLCV.
- Timeframe pills above the chart: `5m / 1h / 4h / 1d`.
- **Polling refresh:** re-fetch on an interval (≈the timeframe, floored to a sane minimum) and update the most-recent candle in place. The 5-min TTL on recent buckets means a refetch returns fresh candles without hammering GeckoTerminal.

### Phase 3 — Basic indicators

- Volume (always, as a bottom pane).
- Toggleable SMA 20 and EMA 50 overlays.
- Indicator chip row above the chart: `[Volume] [SMA20] [EMA50]`.
- Defer RSI / MACD / Bollinger Bands to v1.5.

### Phase 4 — Social overlays (the differentiator)

- Three new aggregate types written by the existing tweet-ingestion pipeline:
  - `SOCIAL_SPIKE_<symbol>` — buckets where mentions/min > N σ above baseline
  - `KOL_POST_<symbol>` — posts from a curated KOL handle list
  - `SENTIMENT_SPIKE_<symbol>` — significant sentiment swings
- New API `GET /api/social-events/[symbol]?from=...&to=...&types=spike,kol,sentiment`.
- Rendered as Lightweight Charts markers: triangle-up for positive spike, triangle-down for negative, dot for KOL post.
- Click marker → small floating card showing the underlying tweets with a deep-link into the M1 live feed filtered to those tweets.

### Phase 5 — Live price tick + wire into the app

- **Jupiter live-price tick:** a `JupiterPriceProvider` (`lib/jupiter.ts`, keyless `GET https://lite-api.jup.ag/price/v3?ids=<mint>`) returning the current USD spot price by mint; `GET /api/price/[symbol]/live` returns the latest tick. The chart header / ticker shows a live last price that updates faster than the candle cadence.
- Replace the SVG sparkline in `TokenDetailPane.tsx` with `<CandleChart>`.
- Implement the `'candlestick'` card type in the M2 dashboard card system: `options: { symbol, interval, indicators[], overlays[] }`.
- Bonus: when a token is dragged into M3 Hum, include chart context in the conversation.

### Phase 6 — Rate-limit guardrails + background ingestion

- DynamoDB atomic counter tracking GeckoTerminal calls/min against the ~30/min free-tier budget (and Jupiter's shared free limit).
- If approaching the limit, serve stale-cache only; small indicator on the chart: "live data paused — retrying in Ns".
- Longer-term: background ingestion for the top-N most-charted tokens to amortize the API budget and keep their candles warm.

## Dependencies

- Requires M1 (social-event aggregates power the overlays).
- Provides the candlestick card type to M2 and the price snapshot data to M7 (M7's ticker reuses `getOHLCV`; its Birdeye references should be updated to GeckoTerminal too).

## Provider research (2026-05-27) — why GeckoTerminal + Jupiter

Free options for Solana price data were evaluated against: arbitrary SPL/memecoin coverage, real OHLCV at 5m/1h/4h/1d, no/low cost, and **commercial-use permitted on the free tier**.

**OHLCV candles**
- **GeckoTerminal (chosen primary):** keyless, real OHLCV by pool address, arbitrary Solana pools, 30 req/min, official CoinGecko-backed, commercial use OK (attribution appreciated). History ~6 months; "Beta" label is the only watch-item.
- **DexPaprika (fallback candidate):** same pool-address OHLCV shape, keyless, longer 1-year history — but commercial-use terms are unverified.
- **Moralis (fallback candidate):** real OHLCV by pair address, commercial use explicitly allowed, but requires a key and is credit-metered (30M CU/mo).
- **Rejected:** DexScreener & Jupiter have *no OHLCV*; CoinGecko `/coins` Demo & CoinPaprika free *forbid commercial use* and don't cover memecoins; Bitquery's free tier is a *1-month trial*; DefiLlama has *no token OHLCV*.

**Real-time / streaming** — finding: **free, true-websocket streaming of arbitrary memecoins does not exist.** Every arbitrary-coverage stream is paid (Yellowstone/Geyser, Helius Enhanced WS, CoinGecko OnchainOHLCV WS), commercially prohibited on free (Bitquery ToS), or hands you raw swap txns to decode on an unreliable cap (public RPC / Helius standard WS). Pyth Hermes streams cleanly and free but only covers a curated set of blue-chips (a random pump.fun mint has no feed).
- **Chosen approach:** poll the latest candle (cache-refresh) for all tokens + **Jupiter Price API v3** (keyless, any mint, poll-only) for a clean live last-price tick. Pyth (majors-only true stream) is a possible later upgrade, out of v1.
