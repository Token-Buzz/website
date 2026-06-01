import type { PriceProvider, PriceInterval, OHLCVBar, TokenRef, TokenCandidate } from './price'
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

/**
 * Pure parser for the GET /search/pools response.
 * Builds a Map from included-entry id to entry for fast lookup of base/quote
 * token attributes and dex names. Returns candidates sorted by reserveUsd desc
 * (nulls last). Skips any pool that has no usable address or base-token mint.
 */
export function parseSearchPools(json: unknown): TokenCandidate[] {
  if (typeof json !== 'object' || json === null) return []

  const root = json as Record<string, unknown>
  const data = root.data
  if (!Array.isArray(data)) return []

  // Build lookup map from included entries (tokens + dexes).
  const included = root.included
  const includedMap = new Map<string, Record<string, unknown>>()
  if (Array.isArray(included)) {
    for (const entry of included as Array<unknown>) {
      if (typeof entry !== 'object' || entry === null) continue
      const e = entry as Record<string, unknown>
      if (typeof e.id === 'string') {
        includedMap.set(e.id, e)
      }
    }
  }

  const candidates: TokenCandidate[] = []

  for (const item of data as Array<unknown>) {
    if (typeof item !== 'object' || item === null) continue
    const pool = item as Record<string, unknown>

    const attrs = (typeof pool.attributes === 'object' && pool.attributes !== null)
      ? pool.attributes as Record<string, unknown>
      : {}

    const address = attrs.address
    if (typeof address !== 'string' || !address) continue

    const name = typeof attrs.name === 'string' ? attrs.name : ''

    // Parse price, reserve, volume (NaN → null).
    const rawPrice = parseFloat(String(attrs.base_token_price_usd ?? ''))
    const priceUsd = isNaN(rawPrice) ? null : rawPrice

    const rawReserve = parseFloat(String(attrs.reserve_in_usd ?? ''))
    const reserveUsd = isNaN(rawReserve) ? null : rawReserve

    const volumeAttrs = (typeof attrs.volume_usd === 'object' && attrs.volume_usd !== null)
      ? attrs.volume_usd as Record<string, unknown>
      : {}
    const rawVol = parseFloat(String(volumeAttrs.h24 ?? ''))
    const volume24hUsd = isNaN(rawVol) ? null : rawVol

    // Resolve relationships.
    const rels = (typeof pool.relationships === 'object' && pool.relationships !== null)
      ? pool.relationships as Record<string, unknown>
      : {}

    // Base token.
    const baseTokenRel = (typeof rels.base_token === 'object' && rels.base_token !== null)
      ? rels.base_token as Record<string, unknown>
      : {}
    const baseTokenData = (typeof baseTokenRel.data === 'object' && baseTokenRel.data !== null)
      ? baseTokenRel.data as Record<string, unknown>
      : {}
    const rawBaseId = baseTokenData.id
    if (typeof rawBaseId !== 'string' || !rawBaseId) continue

    const mint = rawBaseId.startsWith('solana_') ? rawBaseId.slice('solana_'.length) : rawBaseId

    // Resolve base token info from included map.
    let baseSymbol: string | null = null
    let baseName: string | null = null
    const baseIncluded = includedMap.get(rawBaseId)
    if (baseIncluded) {
      const ba = (typeof baseIncluded.attributes === 'object' && baseIncluded.attributes !== null)
        ? baseIncluded.attributes as Record<string, unknown>
        : {}
      baseSymbol = typeof ba.symbol === 'string' ? ba.symbol : null
      baseName = typeof ba.name === 'string' ? ba.name : null
    }

    // Quote token.
    const quoteTokenRel = (typeof rels.quote_token === 'object' && rels.quote_token !== null)
      ? rels.quote_token as Record<string, unknown>
      : {}
    const quoteTokenData = (typeof quoteTokenRel.data === 'object' && quoteTokenRel.data !== null)
      ? quoteTokenRel.data as Record<string, unknown>
      : {}
    let quoteSymbol: string | null = null
    if (typeof quoteTokenData.id === 'string') {
      const quoteIncluded = includedMap.get(quoteTokenData.id)
      if (quoteIncluded) {
        const qa = (typeof quoteIncluded.attributes === 'object' && quoteIncluded.attributes !== null)
          ? quoteIncluded.attributes as Record<string, unknown>
          : {}
        quoteSymbol = typeof qa.symbol === 'string' ? qa.symbol : null
      }
    }

    // Dex: prefer human name from included, fall back to relationship id.
    const dexRel = (typeof rels.dex === 'object' && rels.dex !== null)
      ? rels.dex as Record<string, unknown>
      : {}
    const dexData = (typeof dexRel.data === 'object' && dexRel.data !== null)
      ? dexRel.data as Record<string, unknown>
      : {}
    let dex: string | null = null
    if (typeof dexData.id === 'string' && dexData.id) {
      const dexId = dexData.id as string
      const dexIncluded = includedMap.get(dexId)
      if (dexIncluded) {
        const da = (typeof dexIncluded.attributes === 'object' && dexIncluded.attributes !== null)
          ? dexIncluded.attributes as Record<string, unknown>
          : {}
        dex = typeof da.name === 'string' && da.name ? da.name : dexId
      } else {
        dex = dexId
      }
    }

    candidates.push({
      pool: address,
      mint,
      name,
      baseSymbol,
      baseName,
      quoteSymbol,
      dex,
      priceUsd,
      reserveUsd,
      volume24hUsd,
      chain: 'solana',
      source: 'geckoterminal',
    })
  }

  // Sort by reserveUsd descending, nulls last.
  candidates.sort((a, b) => {
    if (a.reserveUsd === null && b.reserveUsd === null) return 0
    if (a.reserveUsd === null) return 1
    if (b.reserveUsd === null) return -1
    return b.reserveUsd - a.reserveUsd
  })

  return candidates
}

async function searchPools(symbol: string): Promise<TokenCandidate[]> {
  let res: Response
  try {
    res = await fetch(
      `${BASE_URL}/search/pools?query=${encodeURIComponent(symbol)}&network=solana&page=1`,
      { headers: { Accept: ACCEPT_HEADER } },
    )
  } catch {
    return []
  }

  if (!res.ok) return []

  return parseSearchPools(await res.json())
}

export const geckoTerminalProvider: PriceProvider = {
  id: 'geckoterminal',
  resolve,
  fetchOHLCV,
  search: searchPools,
}
