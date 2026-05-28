export const SNAPSHOT_PATH = '/static/ticker.json'

export interface TickerToken {
  symbol: string
  price: number | null
  deltaPct: number | null
  buzzDelta: number
}

export interface TickerSnapshot {
  updatedAt: string
  tokens: TickerToken[]
}

export function displaySymbol(symbol: string): string {
  return symbol.startsWith('$') ? symbol.slice(1) : symbol
}

export function formatPrice(price: number | null): string {
  if (price === null) return '—'
  if (price <= 0) return '$0'
  if (price >= 1) {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  // 0 < price < 1 — 3 significant figures
  const exp = Math.floor(Math.log10(price))
  const decimals = Math.min(12, -exp + 2)
  const s = price.toFixed(decimals).replace(/0+$/, '')
  return '$' + s
}

export function formatBuzz(buzzDelta: number): string {
  const pct = Math.round(buzzDelta * 100)
  const sign = pct >= 0 ? '+' : '−'
  return `buzz ${sign}${Math.abs(pct)}%`
}

export const TRENDING_THRESHOLD = 1

export const FALLBACK_TOKENS: TickerToken[] = [
  { symbol: 'PEPE',  price: 0.0000182,  deltaPct: 24.10, buzzDelta: 4.12 },
  { symbol: 'SOL',   price: 182.40,     deltaPct: -2.31, buzzDelta: -0.18 },
  { symbol: 'TURBO', price: 0.0041,     deltaPct: 8.07,  buzzDelta: 0.96 },
  { symbol: 'BONK',  price: 0.000033,   deltaPct: -4.62, buzzDelta: 0.07 },
  { symbol: 'WIF',   price: 2.41,       deltaPct: 12.40, buzzDelta: 0.84 },
  { symbol: 'MOG',   price: 0.00000176, deltaPct: 41.20, buzzDelta: 2.18 },
  { symbol: 'BRETT', price: 0.092,      deltaPct: -1.18, buzzDelta: 0.22 },
  { symbol: 'DOGE',  price: 0.171,      deltaPct: 0.42,  buzzDelta: -0.04 },
  { symbol: 'FART',  price: 0.0014,     deltaPct: 18.30, buzzDelta: 1.32 },
]
