import type { PriceProvider, PriceInterval, OHLCVBar, MintInfo } from './price'

const BASE_URL = 'https://public-api.birdeye.so'

// Map our interval strings to Birdeye's type parameter values.
const BIRDEYE_INTERVAL: Record<PriceInterval, string> = {
  '5m': '5m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
}

export class BirdeyeError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'BirdeyeError'
  }
}

async function fetchOHLCV(mint: string, interval: PriceInterval, from: number, to: number): Promise<OHLCVBar[]> {
  const apiKey = process.env.BIRDEYE_API_KEY
  if (!apiKey) throw new BirdeyeError('BIRDEYE_API_KEY is not set', 0)

  const type = BIRDEYE_INTERVAL[interval]
  const url = `${BASE_URL}/defi/ohlcv?address=${encodeURIComponent(mint)}&type=${type}&time_from=${from}&time_to=${to}`

  const res = await fetch(url, {
    headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' },
  })

  if (!res.ok) {
    throw new BirdeyeError(`Birdeye OHLCV request failed: ${res.status}`, res.status)
  }

  const json = (await res.json()) as {
    success?: boolean
    data?: { items?: Array<{ unixTime: number; o: number; h: number; l: number; c: number; v: number }> }
  }

  const items = json?.data?.items
  if (!Array.isArray(items)) return []

  return items.map((item) => ({
    ts: item.unixTime,
    open: item.o,
    high: item.h,
    low: item.l,
    close: item.c,
    volume: item.v,
  }))
}

// NOTE: The exact search response shape may need adjustment once a live key is available.
// Birdeye's /defi/v3/search response nests token results; we parse defensively.
async function resolveMint(symbol: string): Promise<MintInfo | null> {
  const apiKey = process.env.BIRDEYE_API_KEY
  if (!apiKey) throw new BirdeyeError('BIRDEYE_API_KEY is not set', 0)

  const url = `${BASE_URL}/defi/v3/search?chain=solana&keyword=${encodeURIComponent(symbol)}&target=token&sort_by=volume_24h_usd&sort_type=desc`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' },
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  try {
    const json = (await res.json()) as unknown
    // Birdeye search nests results; walk defensively to extract an address.
    const data = (json as Record<string, unknown>)?.data
    const tokenList = (data as Record<string, unknown>)?.items as unknown[] | undefined
    if (!Array.isArray(tokenList) || tokenList.length === 0) return null

    const first = tokenList[0] as Record<string, unknown>
    const address = first?.address
    if (typeof address !== 'string' || !address) return null

    return { mint: address, chain: 'solana', source: 'birdeye' }
  } catch {
    return null
  }
}

export const birdeyeProvider: PriceProvider = {
  id: 'birdeye',
  resolveMint,
  fetchOHLCV,
}
