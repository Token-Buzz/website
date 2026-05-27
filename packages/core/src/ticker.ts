import type { OHLCVBar } from './providers/price'

/** One token row in the marketing live-ticker snapshot. */
export interface TickerToken {
  /** Canonical stored symbol, e.g. "$SOL" (may include a leading "$"). */
  symbol: string
  /** Latest USD price (last OHLCV close), or null when there's no price data. */
  price: number | null
  /** 24h price change as a PERCENT (e.g. -3.2 = -3.2%), or null when <24h of history. */
  deltaPct: number | null
  /** Hour-over-hour mentions change as a FRACTION (e.g. 1.5 = +150%). */
  buzzDelta: number
}

export interface TickerSnapshot {
  /** ISO-8601 timestamp the snapshot was generated. */
  updatedAt: string
  tokens: TickerToken[]
}

const DAY_SECONDS = 86_400

/**
 * Latest price + 24h percent change from an OHLCV series. price = last close;
 * deltaPct compares the latest close against the close of the most recent bar
 * at or before (latest.ts - 24h). Returns nulls when there isn't enough data.
 * Tolerates unsorted input.
 */
export function derivePriceFromBars(
  bars: OHLCVBar[],
): { price: number | null; deltaPct: number | null } {
  if (!bars || bars.length === 0) return { price: null, deltaPct: null }
  const sorted = [...bars].sort((a, b) => a.ts - b.ts)
  const latest = sorted[sorted.length - 1]
  const price = latest.close
  const target = latest.ts - DAY_SECONDS
  let prior: OHLCVBar | undefined
  for (const bar of sorted) {
    if (bar.ts <= target) prior = bar
    else break
  }
  if (!prior || prior.close <= 0) return { price, deltaPct: null }
  const deltaPct = Math.round(((price - prior.close) / prior.close) * 10000) / 100
  return { price, deltaPct }
}
