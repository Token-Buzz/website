import { describe, it, expect } from 'vitest'
import { PRICE_INTERVALS } from '@monorepo-template/core/providers/price'
import {
  UP_COLOR, DOWN_COLOR,
  toCandleData, toVolumeData, pollIntervalMs,
} from './candleChart'

const bar = (ts: number, open: number, high: number, low: number, close: number, volume: number) =>
  ({ ts, open, high, low, close, volume })

describe('toCandleData', () => {
  it('maps fields correctly', () => {
    const result = toCandleData([bar(1000, 1, 2, 0.5, 1.5, 500)])
    expect(result).toEqual([{ time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 }])
  })

  it('preserves order and length for multiple bars', () => {
    const bars = [bar(1000, 1, 2, 0.5, 1.5, 100), bar(2000, 2, 3, 1, 2.5, 200), bar(3000, 3, 4, 2, 3.5, 300)]
    const result = toCandleData(bars)
    expect(result).toHaveLength(3)
    expect(result[0].time).toBe(1000)
    expect(result[1].time).toBe(2000)
    expect(result[2].time).toBe(3000)
  })

  it('returns empty array for empty input', () => {
    expect(toCandleData([])).toEqual([])
  })
})

describe('toVolumeData', () => {
  it('assigns UP_COLOR+80 when close > open', () => {
    const result = toVolumeData([bar(1000, 1, 2, 0.5, 1.5, 500)])
    expect(result[0].color).toBe(UP_COLOR + '80')
    expect(result[0].value).toBe(500)
    expect(result[0].time).toBe(1000)
  })

  it('assigns UP_COLOR+80 when close === open (equal)', () => {
    const result = toVolumeData([bar(1000, 1, 2, 0.5, 1, 100)])
    expect(result[0].color).toBe(UP_COLOR + '80')
  })

  it('assigns DOWN_COLOR+80 when close < open', () => {
    const result = toVolumeData([bar(1000, 2, 3, 0.5, 1, 200)])
    expect(result[0].color).toBe(DOWN_COLOR + '80')
  })

  it('maps value from volume', () => {
    const result = toVolumeData([bar(1000, 1, 2, 0.5, 1.5, 9999)])
    expect(result[0].value).toBe(9999)
  })
})

describe('pollIntervalMs', () => {
  it('returns 300000 for 5m (300s clamped to 300s ceiling)', () => {
    expect(pollIntervalMs('5m')).toBe(300000)
  })

  it('returns 300000 for 1h (3600s clamped to 300s ceiling)', () => {
    expect(pollIntervalMs('1h')).toBe(300000)
  })

  it('returns 300000 for 4h (14400s clamped to 300s ceiling)', () => {
    expect(pollIntervalMs('4h')).toBe(300000)
  })

  it('returns 300000 for 1d (86400s clamped to 300s ceiling)', () => {
    expect(pollIntervalMs('1d')).toBe(300000)
  })

  it('result is within [30000, 300000] for every interval', () => {
    for (const interval of PRICE_INTERVALS) {
      const ms = pollIntervalMs(interval)
      expect(ms).toBeGreaterThanOrEqual(30000)
      expect(ms).toBeLessThanOrEqual(300000)
    }
  })
})
