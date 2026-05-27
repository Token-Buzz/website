import { describe, test, expect } from 'vitest'
import {
  INTERVAL_SECONDS,
  PRICE_INTERVALS,
  isPriceInterval,
  expectedBuckets,
  missingBuckets,
  ttlForBucket,
} from './price'

// ── INTERVAL_SECONDS ──────────────────────────────────────────────────────────

describe('INTERVAL_SECONDS', () => {
  test('5m maps to 300', () => {
    expect(INTERVAL_SECONDS['5m']).toBe(300)
  })

  test('1h maps to 3600', () => {
    expect(INTERVAL_SECONDS['1h']).toBe(3600)
  })

  test('4h maps to 14400', () => {
    expect(INTERVAL_SECONDS['4h']).toBe(14400)
  })

  test('1d maps to 86400', () => {
    expect(INTERVAL_SECONDS['1d']).toBe(86400)
  })

  test('covers all PRICE_INTERVALS', () => {
    for (const iv of PRICE_INTERVALS) {
      expect(INTERVAL_SECONDS[iv]).toBeGreaterThan(0)
    }
  })
})

// ── isPriceInterval ───────────────────────────────────────────────────────────

describe('isPriceInterval', () => {
  test('accepts all valid intervals', () => {
    expect(isPriceInterval('5m')).toBe(true)
    expect(isPriceInterval('1h')).toBe(true)
    expect(isPriceInterval('4h')).toBe(true)
    expect(isPriceInterval('1d')).toBe(true)
  })

  test('rejects invalid strings', () => {
    expect(isPriceInterval('1m')).toBe(false)
    expect(isPriceInterval('1H')).toBe(false)
    expect(isPriceInterval('')).toBe(false)
    expect(isPriceInterval('1week')).toBe(false)
  })
})

// ── expectedBuckets ───────────────────────────────────────────────────────────

describe('expectedBuckets', () => {
  test('from mid-bucket rounds up to next boundary', () => {
    // 1h step = 3600. from = 3601 is mid-bucket; next boundary is 7200.
    const buckets = expectedBuckets(3601, 14400, '1h')
    expect(buckets[0]).toBe(7200)
  })

  test('from exactly on boundary includes that boundary', () => {
    const buckets = expectedBuckets(3600, 7200, '1h')
    expect(buckets[0]).toBe(3600)
  })

  test('inclusive of to when to is aligned', () => {
    const buckets = expectedBuckets(0, 10800, '1h')
    expect(buckets).toContain(10800)
  })

  test('returns correct number of buckets for a 1h range', () => {
    // from=0 to=7200 at 1h step: buckets at 0, 3600, 7200 = 3 buckets
    const buckets = expectedBuckets(0, 7200, '1h')
    expect(buckets).toEqual([0, 3600, 7200])
  })

  test('returns empty array when from > to', () => {
    const buckets = expectedBuckets(7200, 3600, '1h')
    expect(buckets).toEqual([])
  })

  test('returns single bucket when from and to are the same aligned boundary', () => {
    const buckets = expectedBuckets(3600, 3600, '1h')
    expect(buckets).toEqual([3600])
  })

  test('5m step: returns aligned buckets', () => {
    // step=300. from=0, to=600 → buckets at 0, 300, 600
    const buckets = expectedBuckets(0, 600, '5m')
    expect(buckets).toEqual([0, 300, 600])
  })
})

// ── missingBuckets ────────────────────────────────────────────────────────────

describe('missingBuckets', () => {
  test('returns only buckets not in cached set', () => {
    const cached = new Set([0, 3600])
    const missing = missingBuckets(0, 7200, '1h', cached)
    expect(missing).toEqual([7200])
  })

  test('returns empty array when all buckets are cached', () => {
    const cached = new Set([0, 3600, 7200])
    const missing = missingBuckets(0, 7200, '1h', cached)
    expect(missing).toEqual([])
  })

  test('returns all buckets when none are cached', () => {
    const cached = new Set<number>()
    const missing = missingBuckets(0, 7200, '1h', cached)
    expect(missing).toEqual([0, 3600, 7200])
  })
})

// ── ttlForBucket ──────────────────────────────────────────────────────────────

describe('ttlForBucket', () => {
  const nowSec = 1_700_000_000

  test('recent bucket (within last hour) gets nowSec+300', () => {
    const recentTs = nowSec - 100 // well within 1h
    expect(ttlForBucket(recentTs, nowSec)).toBe(nowSec + 300)
  })

  test('bucket older than 1h returns undefined (immutable)', () => {
    const oldTs = nowSec - 7200 // 2 hours old
    expect(ttlForBucket(oldTs, nowSec)).toBeUndefined()
  })

  test('bucket at exactly nowSec-3600 is still recent', () => {
    const boundary = nowSec - 3600
    expect(ttlForBucket(boundary, nowSec)).toBe(nowSec + 300)
  })

  test('bucket at nowSec-3601 is just past the boundary, returns undefined', () => {
    const justPast = nowSec - 3601
    expect(ttlForBucket(justPast, nowSec)).toBeUndefined()
  })
})
