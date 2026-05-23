# M6 — Candlestick + Price Charts

Real candle charts with social-event overlays — the unique angle vs. every other charting tool. Replaces the existing hand-rolled SVG sparkline on the token detail page and fills the M2 candlestick card type.

## ClickUp tasks consolidated here

- Price Charts API (parent)
- Create a candlestick chart feature with a few basic indicators

## Locked decisions

- **Birdeye** as v1 price-data provider (Solana-heavy crypto).
- **Cache-through** DynamoDB caching with TTL — first request hits Birdeye, writes to DDB with TTL, subsequent requests within TTL hit DDB.
- **TradingView Lightweight Charts** (Apache 2.0) as the rendering library.
- **Social overlays IN v1** — sentiment spikes, mention bursts, KOL posts overlaid as markers on the candle chart. This is the differentiator.
- **Single `PriceProvider` interface from day 1** — so a second provider (GeckoTerminal, DexScreener) can slot in later without rewriting the cache layer or UI.

## TTL strategy

- Recent buckets (≤1h old): TTL = 5 min so they refresh.
- Historical buckets (>1h old): immutable, no TTL.

## Schema additions

```ts
// secrets
BIRDEYE_API_KEY

// Tokens table — cached OHLCV rows
ohlcvKey(symbol, interval, ts) => {
  pk: `TOKEN#${symbol}`,
  sk: `OHLCV#${interval}#${ts}`,
}
// attrs: { open, high, low, close, volume, ttl? }

// Tokens table — symbol → mint mapping cache
tokenMintKey(symbol) => {
  pk: `TOKEN#${symbol}`,
  sk: 'MINT',
}
// attrs: { mint, chain, source }
```

## Phases

### Phase 1 — Birdeye provider + cache-through API

- `packages/core/src/providers/birdeye.ts` wraps Birdeye's `/defi/ohlcv` endpoint.
- Symbol → mint resolution via Birdeye's token-list endpoint, cached at `TOKEN#<sym>#MINT`.
- Core function `getOHLCV(symbol, interval, from, to)`: queries DDB for cached buckets, fetches gaps from Birdeye, writes back with TTL, returns merged.
- New API route `GET /api/price/[symbol]?interval=5m&from=...&to=...`.
- All behind a `PriceProvider` interface for future provider swap.

### Phase 2 — `<CandleChart>` component

- Built on `lightweight-charts`.
- Props `{ symbol, interval, height? }`.
- Fetches `/api/price/[symbol]`, renders candle series + volume bar series, crosshair tooltip with OHLCV.
- Timeframe pills above the chart: `5m / 1h / 4h / 1d`.

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

### Phase 5 — Wire into the app

- Replace the SVG sparkline in `TokenDetailPane.tsx` with `<CandleChart>`.
- Implement the `'candlestick'` card type in the M2 dashboard card system: `options: { symbol, interval, indicators[], overlays[] }`.
- Bonus: when a token is dragged into M3 Hum, include chart context in the conversation.

### Phase 6 — Cost guardrails

- DynamoDB atomic counter tracking Birdeye calls/min.
- If approaching the limit, serve stale-cache only; small indicator on the chart: "live data paused — retrying in Ns".
- Longer-term: background ingestion for the top-N most-charted tokens to amortize API cost.

## Dependencies

- Requires M1 (social-event aggregates power the overlays).
- Provides the candlestick card type to M2 and the price snapshot data to M7.
