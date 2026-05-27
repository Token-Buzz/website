import { INTERVAL_SECONDS, type PriceInterval, type OHLCVBar } from '@monorepo-template/core/providers/price'

export const UP_COLOR = '#7BC47F'
export const DOWN_COLOR = '#E0664E'

export const SMA_COLOR = '#5B8DEF'
export const EMA_COLOR = '#C792EA'
export const SMA_PERIOD = 20
export const EMA_PERIOD = 50

export interface LinePoint {
  time: number
  value: number
}

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

// Simple moving average of close over `period` bars (time-ascending input)
export function sma(bars: OHLCVBar[], period: number): LinePoint[] {
  if (period <= 0 || bars.length < period) return []
  const out: LinePoint[] = []
  let sum = 0
  for (let i = 0; i < period; i++) sum += bars[i].close
  out.push({ time: bars[period - 1].ts, value: sum / period })
  for (let i = period; i < bars.length; i++) {
    sum += bars[i].close - bars[i - period].close
    out.push({ time: bars[i].ts, value: sum / period })
  }
  return out
}

// Exponential moving average of close over `period` bars (time-ascending input)
// Seeded with SMA of the first `period` closes.
export function ema(bars: OHLCVBar[], period: number): LinePoint[] {
  if (period <= 0 || bars.length < period) return []
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i++) sum += bars[i].close
  let prev = sum / period
  const out: LinePoint[] = [{ time: bars[period - 1].ts, value: prev }]
  for (let i = period; i < bars.length; i++) {
    prev = bars[i].close * k + prev * (1 - k)
    out.push({ time: bars[i].ts, value: prev })
  }
  return out
}

// Poll cadence ≈ the timeframe, clamped to 30s floor and 300s ceiling
// (300s is the recent-bucket cache TTL so the forming candle stays fresh even on long frames)
export function pollIntervalMs(interval: PriceInterval): number {
  return Math.min(Math.max(INTERVAL_SECONDS[interval], 30), 300) * 1000
}
