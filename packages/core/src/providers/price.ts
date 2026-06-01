export type PriceInterval = '5m' | '1h' | '4h' | '1d'

export interface OHLCVBar {
  ts: number      // unix seconds, bucket start
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TokenRef {
  symbol: string
  mint: string      // SPL mint address (for spot-price providers like Jupiter later)
  pool: string      // DEX pool/pair address — how OHLCV providers address candles
  chain: string     // 'solana'
  source: string    // provider id, e.g. 'geckoterminal'
}

export interface TokenCandidate {
  pool: string              // DEX pool address
  mint: string              // base-token SPL mint
  name: string              // pool display name, e.g. "BONK / SOL"
  baseSymbol: string | null
  baseName: string | null
  quoteSymbol: string | null
  dex: string | null        // dex id or human name, e.g. "Raydium"
  priceUsd: number | null
  reserveUsd: number | null
  volume24hUsd: number | null
  chain: string             // 'solana'
  source: string            // provider id, e.g. 'geckoterminal'
}

/** Convert a TokenCandidate to a TokenRef, using the supplied symbol as the canonical symbol. */
export function candidateToRef(symbol: string, c: TokenCandidate): TokenRef {
  return {
    symbol: symbol.toUpperCase(),
    mint: c.mint,
    pool: c.pool,
    chain: 'solana',
    source: c.source,
  }
}

export interface PriceProvider {
  readonly id: string
  resolve(symbol: string): Promise<TokenRef | null>
  fetchOHLCV(ref: TokenRef, interval: PriceInterval, from: number, to: number): Promise<OHLCVBar[]>
  search(symbol: string): Promise<TokenCandidate[]>
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
