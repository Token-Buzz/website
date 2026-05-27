import { describe, it, expect } from 'vitest'
import { derivePriceFromBars } from './ticker'
import type { OHLCVBar } from './providers/price'

function bar(ts: number, close: number): OHLCVBar {
  return { ts, open: close, high: close, low: close, close, volume: 0 }
}

describe('derivePriceFromBars', () => {
  it('returns nulls for an empty array', () => {
    expect(derivePriceFromBars([])).toEqual({ price: null, deltaPct: null })
  })

  it('returns price=close and deltaPct=null for a single bar (no 24h-ago bar)', () => {
    const result = derivePriceFromBars([bar(1_000_000, 50)])
    expect(result).toEqual({ price: 50, deltaPct: null })
  })

  it('computes correct deltaPct from a 25-bar hourly series', () => {
    // 25 bars, 1h apart. latest ts = 0 + 24*3600 = 86400, close=110.
    // bar at ts=0 has close=100, and 0 <= 86400 - 86400 = 0, so it's the prior bar.
    const bars: OHLCVBar[] = []
    for (let i = 0; i < 25; i++) {
      const ts = i * 3600
      const close = i === 0 ? 100 : i === 24 ? 110 : 105
      bars.push(bar(ts, close))
    }
    const result = derivePriceFromBars(bars)
    expect(result.price).toBe(110)
    expect(result.deltaPct).toBe(10)
  })

  it('returns deltaPct=null when series spans < 24h (no bar at or before 24h-ago target)', () => {
    // 5 hourly bars. latest ts = 4*3600=14400, target = 14400 - 86400 = -72000
    // No bar has ts <= -72000, so prior is undefined.
    const bars: OHLCVBar[] = []
    for (let i = 0; i < 5; i++) {
      bars.push(bar(i * 3600, 100 + i))
    }
    const result = derivePriceFromBars(bars)
    expect(result.price).toBe(104)
    expect(result.deltaPct).toBeNull()
  })

  it('returns deltaPct=null when prior bar close is 0', () => {
    // 25 bars; bar at ts=0 has close=0 (division by zero guard).
    const bars: OHLCVBar[] = []
    for (let i = 0; i < 25; i++) {
      const ts = i * 3600
      const close = i === 0 ? 0 : 50
      bars.push(bar(ts, close))
    }
    const result = derivePriceFromBars(bars)
    expect(result.price).toBe(50)
    expect(result.deltaPct).toBeNull()
  })

  it('handles unsorted input correctly (same result as sorted)', () => {
    // Same 25-bar series as the correct deltaPct test, but shuffled.
    const bars: OHLCVBar[] = []
    for (let i = 0; i < 25; i++) {
      const ts = i * 3600
      const close = i === 0 ? 100 : i === 24 ? 110 : 105
      bars.push(bar(ts, close))
    }
    // Reverse to unsort
    const unsorted = [...bars].reverse()
    const result = derivePriceFromBars(unsorted)
    expect(result.price).toBe(110)
    expect(result.deltaPct).toBe(10)
  })
})
