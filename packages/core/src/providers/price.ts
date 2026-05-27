export type PriceInterval = '5m' | '1h' | '4h' | '1d'

export interface OHLCVBar {
  ts: number      // unix seconds, bucket start
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MintInfo {
  mint: string
  chain: string
  source: string  // provider id, e.g. 'birdeye'
}

export interface PriceProvider {
  readonly id: string
  resolveMint(symbol: string): Promise<MintInfo | null>
  fetchOHLCV(mint: string, interval: PriceInterval, from: number, to: number): Promise<OHLCVBar[]>
}

export const INTERVAL_SECONDS: Record<PriceInterval, number> = {
  '5m': 300, '1h': 3600, '4h': 14400, '1d': 86400,
}

export const PRICE_INTERVALS: PriceInterval[] = ['5m', '1h', '4h', '1d']

export function isPriceInterval(x: string): x is PriceInterval {
  return (PRICE_INTERVALS as string[]).includes(x)
}

// First interval-aligned bucket start >= from, then every step up to and including to.
export function expectedBuckets(from: number, to: number, interval: PriceInterval): number[] {
  const step = INTERVAL_SECONDS[interval]
  const start = Math.ceil(from / step) * step
  const out: number[] = []
  for (let t = start; t <= to; t += step) out.push(t)
  return out
}

export function missingBuckets(from: number, to: number, interval: PriceInterval, cached: Set<number>): number[] {
  return expectedBuckets(from, to, interval).filter((t) => !cached.has(t))
}

// DDB TTL is epoch SECONDS. Recent buckets (start within the last hour relative to nowSec)
// get a 5-minute TTL so they refresh; older buckets are immutable (undefined => no ttl attr).
export function ttlForBucket(bucketTs: number, nowSec: number): number | undefined {
  if (bucketTs >= nowSec - 3600) return nowSec + 300
  return undefined
}
