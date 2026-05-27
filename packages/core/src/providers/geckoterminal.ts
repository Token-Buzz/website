import type { PriceProvider, PriceInterval, OHLCVBar, TokenRef } from './price'
import { INTERVAL_SECONDS } from './price'

const BASE_URL = 'https://api.geckoterminal.com/api/v2'

const ACCEPT_HEADER = 'application/json;version=20230302'

export class GeckoTerminalError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'GeckoTerminalError'
  }
}

// Pure helper — maps our interval strings to GeckoTerminal timeframe + aggregate.
export function gtTimeframe(interval: PriceInterval): { timeframe: string; aggregate: number } {
  const MAP: Record<PriceInterval, { timeframe: string; aggregate: number }> = {
    '5m':  { timeframe: 'minute', aggregate: 5 },
    '1h':  { timeframe: 'hour',   aggregate: 1 },
    '4h':  { timeframe: 'hour',   aggregate: 4 },
    '1d':  { timeframe: 'day',    aggregate: 1 },
  }
  return MAP[interval]
}

// NOTE: the /search/pools response shape may need adjustment against the live API.
async function resolve(symbol: string): Promise<TokenRef | null> {
  let res: Response
  try {
    res = await fetch(
      `${BASE_URL}/search/pools?query=${encodeURIComponent(symbol)}&network=solana&page=1`,
      { headers: { Accept: ACCEPT_HEADER } },
    )
  } catch {
    return null
  }

  if (!res.ok) return null

  try {
    const json = (await res.json()) as unknown
    const data = (json as Record<string, unknown>)?.data
    if (!Array.isArray(data) || data.length === 0) return null

    // Pick the pool with the highest reserve_in_usd; fall back to first item if none parse.
    let best = data[0] as Record<string, unknown>
    let bestReserve = -Infinity
    for (const item of data as Array<Record<string, unknown>>) {
      const attrs = item?.attributes as Record<string, unknown> | undefined
      const reserve = parseFloat(String(attrs?.reserve_in_usd ?? ''))
      if (!isNaN(reserve) && reserve > bestReserve) {
        bestReserve = reserve
        best = item
      }
    }

    const bestAttrs = best?.attributes as Record<string, unknown> | undefined
    const pool = bestAttrs?.address
    if (typeof pool !== 'string' || !pool) return null

    const baseTokenId = (
      (best?.relationships as Record<string, unknown>)?.base_token as Record<string, unknown>
    )?.data as Record<string, unknown> | undefined
    const rawId = baseTokenId?.id
    if (typeof rawId !== 'string' || !rawId) return null

    // Strip the 'solana_' prefix to get the SPL mint address.
    const mint = rawId.startsWith('solana_') ? rawId.slice('solana_'.length) : rawId

    return { symbol: symbol.toUpperCase(), mint, pool, chain: 'solana', source: 'geckoterminal' }
  } catch {
    return null
  }
}

async function fetchOHLCV(ref: TokenRef, interval: PriceInterval, from: number, to: number): Promise<OHLCVBar[]> {
  const { timeframe, aggregate } = gtTimeframe(interval)
  const limit = Math.min(1000, Math.ceil((to - from) / INTERVAL_SECONDS[interval]) + 2)
  const url = `${BASE_URL}/networks/solana/pools/${encodeURIComponent(ref.pool)}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&before_timestamp=${to}&currency=usd`

  const res = await fetch(url, { headers: { Accept: ACCEPT_HEADER } })

  if (!res.ok) {
    throw new GeckoTerminalError(`GeckoTerminal OHLCV request failed: ${res.status}`, res.status)
  }

  const json = (await res.json()) as unknown
  const ohlcvList = (
    (json as Record<string, unknown>)?.data as Record<string, unknown>
  )?.attributes as Record<string, unknown> | undefined

  const rows = ohlcvList?.ohlcv_list
  if (!Array.isArray(rows)) return []

  return (rows as Array<[number, number, number, number, number, number]>).map(
    ([ts, open, high, low, close, volume]) => ({ ts, open, high, low, close, volume }),
  )
}

export const geckoTerminalProvider: PriceProvider = {
  id: 'geckoterminal',
  resolve,
  fetchOHLCV,
}
