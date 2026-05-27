import { INTERVAL_SECONDS, type PriceInterval, type OHLCVBar } from '@monorepo-template/core/providers/price'

export const UP_COLOR = '#7BC47F'
export const DOWN_COLOR = '#E0664E'

export interface CandlePoint {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface VolumePoint {
  time: number
  value: number
  color: string
}

export function toCandleData(bars: OHLCVBar[]): CandlePoint[] {
  return bars.map((b) => ({ time: b.ts, open: b.open, high: b.high, low: b.low, close: b.close }))
}

// Alpha suffix '80' = ~50% opacity in hex
export function toVolumeData(bars: OHLCVBar[]): VolumePoint[] {
  return bars.map((b) => ({
    time: b.ts,
    value: b.volume,
    color: b.close >= b.open ? UP_COLOR + '80' : DOWN_COLOR + '80',
  }))
}

// Poll cadence ≈ the timeframe, clamped to 30s floor and 300s ceiling
// (300s is the recent-bucket cache TTL so the forming candle stays fresh even on long frames)
export function pollIntervalMs(interval: PriceInterval): number {
  return Math.min(Math.max(INTERVAL_SECONDS[interval], 30), 300) * 1000
}
