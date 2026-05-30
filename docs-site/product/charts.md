# Charts

TokenBuzz renders professional candlestick price charts with social-event overlays. The unique value is seeing exactly where social signals — mention spikes, KOL posts, sentiment shifts — land on the price candles.

## Where charts appear

Charts are embedded in two places:

- **Watchlist token detail pane** — click any token in your [Watchlist](./watchlists-and-dashboards.md) to open its detail pane, which includes a candlestick chart.
- **Dashboard grid** — add a candlestick card to any [Dashboard](./watchlists-and-dashboards.md). The card shows the chart for the dashboard's scoped ticker.

## Timeframes

A pill group in the chart header lets you switch between:

- **5m** — 5-minute candles
- **1h** — 1-hour candles (default)
- **4h** — 4-hour candles
- **1d** — daily candles

Switching timeframe reloads the OHLCV data and repositions the social markers.

## Price data

Price data is sourced from GeckoTerminal (on-chain DEX data for Solana tokens) and cached in TokenBuzz to minimize latency. The chart polls for new data automatically to keep the forming candle fresh. A **live** label next to the current price confirms the ticker is updating in real time.

A live price tick in the chart header is updated every 15 seconds from the Jupiter Price API.

If the price provider is temporarily rate-limited, the chart shows a "live data paused — retrying in Xs" notice and resumes automatically.

## Crosshair tooltip

Hover over any candle to see the OHLCV values in a floating tooltip:

- **O** — Open
- **H** — High
- **L** — Low
- **C** — Close (coloured green or red to indicate up/down)
- **Vol** — Volume

## Overlay indicators

Use the chip row below the timeframe selector to toggle optional overlays:

| Chip | What it shows |
|---|---|
| **Volume** | A histogram of trading volume behind the candles. On by default. |
| **SMA 20** | 20-period simple moving average line. |
| **EMA 50** | 50-period exponential moving average line. |
| **Social** | Social event markers overlaid on the candles (see below). On by default. |

## Social event markers

When **Social** is enabled, small coloured markers appear above or below candles at timestamps where a notable social event occurred. Event types include mention spikes and sentiment-scored activity bursts.

Click a marker to open a pop-up card that shows:

- The event title and type.
- A magnitude indicator (e.g. "3σ spike" for a statistical outlier in mention volume).
- Sample posts from that moment, with author handle and an excerpt.
- A **View in live feed →** link that opens the [Live Feed](./live-feed.md) filtered to that token.

Click anywhere else on the chart or the × button on the card to dismiss it.

## Dragging chart context to Hum

The chart supports drag-to-context for [Hum AI](./hum-ai.md). Drag the chart area into the Hum panel to attach price and social data as context for a question (e.g. "Why did this spike at 14:00?").
