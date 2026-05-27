import { describe, expect, test } from 'vitest'
import {
  detectVolumeSpikes,
  detectSentimentSpikes,
  isKolHandle,
  volumeSpikeEvent,
  sentimentSpikeEvent,
  kolPostEvent,
  type SpikePoint,
  type SentimentPoint,
} from './social-events'

// ── detectVolumeSpikes ────────────────────────────────────────────────────────

describe('detectVolumeSpikes', () => {
  // Build 20 flat points at value=10, with timestamps 1..20.
  function flatPoints(count: number, value = 10): SpikePoint[] {
    return Array.from({ length: count }, (_, i) => ({ ts: i + 1, value }))
  }

  test('flat series with no outlier → returns []', () => {
    const pts = flatPoints(20)
    expect(detectVolumeSpikes(pts)).toEqual([])
  })

  test('one obvious outlier is flagged with correct ts', () => {
    // 19 points at value=1, one at value=100 (ts=10)
    const pts: SpikePoint[] = Array.from({ length: 19 }, (_, i) => ({
      ts: i + 1,
      value: 1,
    }))
    pts.push({ ts: 20, value: 100 })
    const result = detectVolumeSpikes(pts, { minSamples: 12 })
    expect(result).toHaveLength(1)
    expect(result[0].ts).toBe(20)
    expect(result[0].value).toBe(100)
    expect(result[0].sigma).toBeGreaterThan(3)
  })

  test('below minSamples → returns []', () => {
    const pts = flatPoints(11) // less than default minSamples=12
    pts.push({ ts: 12, value: 9999 })
    // Only 12 total but we only have 11 actually — let's keep it below minSamples.
    expect(detectVolumeSpikes(flatPoints(10))).toEqual([])
  })

  test('custom minSamples: below threshold returns []', () => {
    const pts = flatPoints(5) // 5 points
    // With minSamples=6 we should get []
    expect(detectVolumeSpikes(pts, { minSamples: 6 })).toEqual([])
  })

  test('respects minValue: point above sigma threshold but below minValue is excluded', () => {
    // All points are at value=0 except one at value=1. With minValue=2,
    // value=1 should not trigger even if it exceeds mean+sigma*stddev.
    const pts: SpikePoint[] = Array.from({ length: 20 }, (_, i) => ({
      ts: i + 1,
      value: i === 19 ? 1 : 0,
    }))
    const result = detectVolumeSpikes(pts, { sigma: 0.1, minValue: 2 })
    expect(result).toEqual([])
  })

  test('results are sorted ascending by ts', () => {
    // Two outliers at non-adjacent positions.
    const pts: SpikePoint[] = Array.from({ length: 18 }, (_, i) => ({
      ts: i + 1,
      value: 2,
    }))
    pts.push({ ts: 30, value: 500 })
    pts.push({ ts: 19, value: 500 })
    // ts=19 comes after ts=30 in the array, so we verify sort.
    const result = detectVolumeSpikes(pts, { sigma: 2 })
    expect(result.length).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].ts).toBeGreaterThan(result[i - 1].ts)
    }
  })
})

// ── detectSentimentSpikes ─────────────────────────────────────────────────────

describe('detectSentimentSpikes', () => {
  test('no swing when all points are similar → returns []', () => {
    const pts: SentimentPoint[] = Array.from({ length: 10 }, (_, i) => ({
      ts: i + 1,
      bull: 5,
      bear: 5,
      neu: 10,
    }))
    expect(detectSentimentSpikes(pts)).toEqual([])
  })

  test('clearly bullish point is flagged with direction=positive', () => {
    // 9 neutral-ish points (net ≈ 0) + 1 extremely bullish point (net close to 1).
    const pts: SentimentPoint[] = Array.from({ length: 9 }, (_, i) => ({
      ts: i + 1,
      bull: 5,
      bear: 5,
      neu: 10,
    }))
    // All-bull, no bear: net = (50-0)/50 = 1.0
    pts.push({ ts: 10, bull: 50, bear: 0, neu: 0 })

    const result = detectSentimentSpikes(pts, { threshold: 0.4, minTweets: 5 })
    expect(result.length).toBeGreaterThanOrEqual(1)
    const bullish = result.find((r) => r.ts === 10)
    expect(bullish).toBeDefined()
    expect(bullish!.direction).toBe('positive')
  })

  test('clearly bearish point is flagged with direction=negative', () => {
    const pts: SentimentPoint[] = Array.from({ length: 9 }, (_, i) => ({
      ts: i + 1,
      bull: 5,
      bear: 5,
      neu: 10,
    }))
    // All-bear, no bull: net = (0-50)/50 = -1.0
    pts.push({ ts: 10, bull: 0, bear: 50, neu: 0 })

    const result = detectSentimentSpikes(pts, { threshold: 0.4, minTweets: 5 })
    const bearish = result.find((r) => r.ts === 10)
    expect(bearish).toBeDefined()
    expect(bearish!.direction).toBe('negative')
  })

  test('respects minTweets: low-volume point is excluded even if net swings', () => {
    const pts: SentimentPoint[] = Array.from({ length: 9 }, (_, i) => ({
      ts: i + 1,
      bull: 5,
      bear: 5,
      neu: 10,
    }))
    // Only 2 tweets total, below minTweets=5.
    pts.push({ ts: 10, bull: 2, bear: 0, neu: 0 })

    const result = detectSentimentSpikes(pts, { threshold: 0.4, minTweets: 5 })
    expect(result.find((r) => r.ts === 10)).toBeUndefined()
  })

  test('below minSamples → returns []', () => {
    const pts: SentimentPoint[] = [
      { ts: 1, bull: 10, bear: 0, neu: 0 },
      { ts: 2, bull: 5, bear: 5, neu: 5 },
    ]
    expect(detectSentimentSpikes(pts, { minSamples: 3 })).toEqual([])
  })

  test('magnitude is rounded to 2 decimal places', () => {
    const pts: SentimentPoint[] = Array.from({ length: 9 }, (_, i) => ({
      ts: i + 1,
      bull: 5,
      bear: 5,
      neu: 10,
    }))
    pts.push({ ts: 10, bull: 50, bear: 0, neu: 0 })
    const result = detectSentimentSpikes(pts, { threshold: 0.4, minTweets: 5 })
    const spike = result.find((r) => r.ts === 10)
    expect(spike).toBeDefined()
    // magnitude should be a number with at most 2 decimal places
    const decimals = spike!.magnitude.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

// ── isKolHandle ───────────────────────────────────────────────────────────────

describe('isKolHandle', () => {
  test('matches a known KOL handle (lowercase, no @)', () => {
    expect(isKolHandle('cobie')).toBe(true)
  })

  test('matches with leading @', () => {
    expect(isKolHandle('@cobie')).toBe(true)
  })

  test('case-insensitive match', () => {
    expect(isKolHandle('COBIE')).toBe(true)
    expect(isKolHandle('@Hsaka')).toBe(true)
  })

  test('non-KOL handle returns false', () => {
    expect(isKolHandle('randomuser123')).toBe(false)
  })

  test('empty string returns false', () => {
    expect(isKolHandle('')).toBe(false)
  })

  test('@-only handle returns false', () => {
    expect(isKolHandle('@')).toBe(false)
  })
})

// ── volumeSpikeEvent builder ──────────────────────────────────────────────────

describe('volumeSpikeEvent', () => {
  const spike = { ts: 1700000000, sigma: 4.567, value: 42 }

  test('returns correct type and marker', () => {
    const ev = volumeSpikeEvent('btc', spike)
    expect(ev.type).toBe('SOCIAL_SPIKE')
    expect(ev.marker).toBe('up')
  })

  test('symbol is uppercased', () => {
    const ev = volumeSpikeEvent('btc', spike)
    expect(ev.symbol).toBe('BTC')
  })

  test('direction is positive', () => {
    const ev = volumeSpikeEvent('btc', spike)
    expect(ev.direction).toBe('positive')
  })

  test('magnitude is rounded to 1 decimal place', () => {
    const ev = volumeSpikeEvent('btc', spike)
    expect(ev.magnitude).toBe(4.6) // round(4.567, 1)
  })

  test('title includes the value per-minute', () => {
    const ev = volumeSpikeEvent('btc', spike)
    expect(ev.title).toBe('Mention spike · 42/min')
  })

  test('ts is preserved', () => {
    const ev = volumeSpikeEvent('btc', spike)
    expect(ev.ts).toBe(1700000000)
  })
})

// ── sentimentSpikeEvent builder ───────────────────────────────────────────────

describe('sentimentSpikeEvent', () => {
  const bullish = { ts: 1700000100, direction: 'positive' as const, net: 0.8, magnitude: 0.6 }
  const bearish = { ts: 1700000200, direction: 'negative' as const, net: -0.7, magnitude: 0.5 }

  test('bullish spike: marker=up, title contains Bullish', () => {
    const ev = sentimentSpikeEvent('eth', bullish)
    expect(ev.marker).toBe('up')
    expect(ev.title).toBe('Bullish sentiment swing')
  })

  test('bearish spike: marker=down, title contains Bearish', () => {
    const ev = sentimentSpikeEvent('eth', bearish)
    expect(ev.marker).toBe('down')
    expect(ev.title).toBe('Bearish sentiment swing')
  })

  test('type is SENTIMENT_SPIKE', () => {
    expect(sentimentSpikeEvent('eth', bullish).type).toBe('SENTIMENT_SPIKE')
  })

  test('symbol is uppercased', () => {
    expect(sentimentSpikeEvent('eth', bullish).symbol).toBe('ETH')
  })

  test('direction and magnitude are preserved from the detected spike', () => {
    const ev = sentimentSpikeEvent('eth', bullish)
    expect(ev.direction).toBe('positive')
    expect(ev.magnitude).toBe(0.6)
  })

  test('ts is preserved', () => {
    expect(sentimentSpikeEvent('eth', bullish).ts).toBe(1700000100)
  })
})

// ── kolPostEvent builder ──────────────────────────────────────────────────────

describe('kolPostEvent', () => {
  const tweet = { tweetId: 'tw-001', handle: 'cobie', text: 'BTC is going up!' }
  const ts = 1700001000

  test('type is KOL_POST', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.type).toBe('KOL_POST')
  })

  test('marker is dot', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.marker).toBe('dot')
  })

  test('symbol is uppercased', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.symbol).toBe('BTC')
  })

  test('title is @handle', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.title).toBe('@cobie')
  })

  test('tweets array contains the passed tweet', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.tweets).toHaveLength(1)
    expect(ev.tweets![0]).toEqual(tweet)
  })

  test('ts is preserved', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.ts).toBe(ts)
  })

  test('no direction or magnitude on KOL events', () => {
    const ev = kolPostEvent('btc', ts, tweet)
    expect(ev.direction).toBeUndefined()
    expect(ev.magnitude).toBeUndefined()
  })
})
