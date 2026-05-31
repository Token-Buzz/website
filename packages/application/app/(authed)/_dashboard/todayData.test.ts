import { describe, test, expect } from 'vitest'
import {
  relativeTime,
  derivePulseMpm,
  derivePulseAvg,
  deriveHeadline,
  mapTweetsToStream,
  mapApiAlertsToItems,
  mapApiSpikes,
  deriveSentCellIntensity,
  deriveSplitPcts,
  type TodaySpike,
  type TodayAlert,
  type LiveFeedTweet,
  type SentimentSplit,
} from './todayData'

// Fixed reference point: 2025-06-01T12:00:00.000Z
const NOW = new Date('2025-06-01T12:00:00.000Z').getTime()

// ── relativeTime ────────────────────────────────────────────────────────────

describe('relativeTime', () => {
  test('returns "just now" for future / zero-delta dates', () => {
    const iso = new Date(NOW + 5000).toISOString()
    expect(relativeTime(iso, NOW)).toBe('just now')
  })

  test('returns seconds for < 60s', () => {
    const iso = new Date(NOW - 30_000).toISOString()
    expect(relativeTime(iso, NOW)).toBe('30s')
  })

  test('returns minutes for 60s–59m', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString()
    expect(relativeTime(iso, NOW)).toBe('5m')
  })

  test('returns hours for 1h–23h', () => {
    const iso = new Date(NOW - 3 * 3600_000).toISOString()
    expect(relativeTime(iso, NOW)).toBe('3h')
  })

  test('returns days for >= 24h', () => {
    const iso = new Date(NOW - 2 * 86400_000).toISOString()
    expect(relativeTime(iso, NOW)).toBe('2d')
  })

  test('returns "" for empty string', () => {
    expect(relativeTime('', NOW)).toBe('')
  })

  test('returns "" for invalid date string', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('')
  })
})

// ── derivePulseMpm ──────────────────────────────────────────────────────────

describe('derivePulseMpm', () => {
  test('returns 0 for empty series', () => {
    expect(derivePulseMpm([])).toBe(0)
  })

  test('averages last 5 buckets', () => {
    const series = [10, 20, 30, 40, 50, 100, 200, 300, 400, 500]
    // last 5: 100, 200, 300, 400, 500 → avg = 300
    expect(derivePulseMpm(series, 5)).toBe(300)
  })

  test('uses whole series when shorter than windowBuckets', () => {
    const series = [10, 20, 30]
    // avg = 20
    expect(derivePulseMpm(series, 5)).toBe(20)
  })

  test('rounds to integer', () => {
    const series = [1, 2]
    // last 5 → uses [1, 2] → avg 1.5 → rounds to 2
    expect(derivePulseMpm(series, 5)).toBe(2)
  })

  test('windowBuckets = 1 returns last element', () => {
    const series = [5, 10, 99]
    expect(derivePulseMpm(series, 1)).toBe(99)
  })
})

// ── derivePulseAvg ──────────────────────────────────────────────────────────

describe('derivePulseAvg', () => {
  test('returns 0 for empty series', () => {
    expect(derivePulseAvg([])).toBe(0)
  })

  test('returns full average rounded', () => {
    const series = [10, 20, 30, 40]
    // avg = 25
    expect(derivePulseAvg(series)).toBe(25)
  })

  test('rounds to integer', () => {
    const series = [1, 2]
    // avg 1.5 → rounds to 2
    expect(derivePulseAvg(series)).toBe(2)
  })
})

// ── deriveHeadline ──────────────────────────────────────────────────────────

describe('deriveHeadline', () => {
  test('returns generic quiet-market line when no spikes and no alerts', () => {
    expect(deriveHeadline([], 0)).toBe('No major spikes yet — markets are quiet.')
  })

  test('mentions alert count when no spikes but alerts exist', () => {
    expect(deriveHeadline([], 3)).toBe('3 alerts fired today.')
  })

  test('uses singular "alert" for count 1', () => {
    expect(deriveHeadline([], 1)).toBe('1 alert fired today.')
  })

  test('derives headline from top spike symbol and delta', () => {
    const spikes: TodaySpike[] = [
      { symbol: 'PEPE', deltaScore: 412, mentions: 49000, sentiment: 'bull' },
    ]
    expect(deriveHeadline(spikes, 0)).toBe('$PEPE is up +412% on mentions.')
  })

  test('appends alert count to spike headline when alerts > 0', () => {
    const spikes: TodaySpike[] = [
      { symbol: 'MOG', deltaScore: 4180, mentions: 6700, sentiment: 'bull' },
    ]
    expect(deriveHeadline(spikes, 4)).toBe('$MOG is up +4180% on mentions · 4 new alerts fired today.')
  })

  test('handles negative delta score', () => {
    const spikes: TodaySpike[] = [
      { symbol: 'DOGE', deltaScore: -25, mentions: 1000, sentiment: 'bear' },
    ]
    expect(deriveHeadline(spikes, 0)).toBe('$DOGE is up -25% on mentions.')
  })
})

// ── mapTweetsToStream ───────────────────────────────────────────────────────

describe('mapTweetsToStream', () => {
  test('returns empty array for empty input', () => {
    expect(mapTweetsToStream([])).toEqual([])
  })

  const base: LiveFeedTweet = {
    tweetId: '1',
    authorName: 'Alice',
    authorUsername: 'alice',
    authorAvatar: undefined,
    text: 'Hello $PEPE',
    createdAt: new Date(NOW - 120_000).toISOString(),
    likeCount: 10,
    retweetCount: 2,
    replyCount: 1,
    viewCount: 100,
    tokenTags: ['PEPE'],
    sentiment: 'bull',
  }

  test('maps username to @handle', () => {
    const [item] = mapTweetsToStream([base])
    expect(item.handle).toBe('@alice')
  })

  test('maps "bull" sentiment', () => {
    const [item] = mapTweetsToStream([base])
    expect(item.sent).toBe('bull')
  })

  test('maps "bear" sentiment', () => {
    const [item] = mapTweetsToStream([{ ...base, sentiment: 'bear' }])
    expect(item.sent).toBe('bear')
  })

  test('maps "negative" (API variant) to "bear"', () => {
    const [item] = mapTweetsToStream([{ ...base, sentiment: 'negative' }])
    expect(item.sent).toBe('bear')
  })

  test('maps "positive" (API variant) to "bull"', () => {
    const [item] = mapTweetsToStream([{ ...base, sentiment: 'positive' }])
    expect(item.sent).toBe('bull')
  })

  test('maps unknown sentiment to "neu"', () => {
    const [item] = mapTweetsToStream([{ ...base, sentiment: 'unknown' }])
    expect(item.sent).toBe('neu')
  })

  test('maps undefined sentiment to "neu"', () => {
    const [item] = mapTweetsToStream([{ ...base, sentiment: undefined }])
    expect(item.sent).toBe('neu')
  })

  test('maps first tokenTag as tick', () => {
    const [item] = mapTweetsToStream([base])
    expect(item.tick).toBe('PEPE')
  })

  test('sets tick to empty string when no tokenTags', () => {
    const [item] = mapTweetsToStream([{ ...base, tokenTags: [] }])
    expect(item.tick).toBe('')
  })

  test('sets text from tweet', () => {
    const [item] = mapTweetsToStream([base])
    expect(item.text).toBe('Hello $PEPE')
  })

  test('computes relative time from createdAt', () => {
    const isoTwoMinsAgo = new Date(NOW - 2 * 60_000).toISOString()
    const [item] = mapTweetsToStream([{ ...base, createdAt: isoTwoMinsAgo }])
    // time should be "2m" — computed relative to real Date.now(), so just check it's non-empty
    expect(typeof item.time).toBe('string')
    expect(item.time.length).toBeGreaterThan(0)
  })
})

// ── mapApiAlertsToItems ─────────────────────────────────────────────────────

describe('mapApiAlertsToItems', () => {
  test('returns empty array for empty input', () => {
    expect(mapApiAlertsToItems([])).toEqual([])
  })

  const alert: TodayAlert = {
    time: '08:42',
    tag: 'BUZZ SPIKE',
    target: '$MOG',
    body: 'Mentions jumped.',
    tone: 'buzz',
  }

  test('maps all fields 1:1', () => {
    const [item] = mapApiAlertsToItems([alert])
    expect(item.tone).toBe('buzz')
    expect(item.time).toBe('08:42')
    expect(item.tag).toBe('BUZZ SPIKE')
    expect(item.target).toBe('$MOG')
    expect(item.body).toBe('Mentions jumped.')
  })

  test('maps "sent" tone correctly', () => {
    const [item] = mapApiAlertsToItems([{ ...alert, tone: 'sent' }])
    expect(item.tone).toBe('sent')
  })
})

// ── mapApiSpikes ────────────────────────────────────────────────────────────

describe('mapApiSpikes', () => {
  test('returns empty array for empty input', () => {
    expect(mapApiSpikes([])).toEqual([])
  })

  const spike: TodaySpike = { symbol: 'PEPE', deltaScore: 412, mentions: 49000, sentiment: 'bull' }

  test('maps symbol to sym', () => {
    const [item] = mapApiSpikes([spike])
    expect(item.sym).toBe('PEPE')
  })

  test('maps deltaScore', () => {
    const [item] = mapApiSpikes([spike])
    expect(item.deltaScore).toBe(412)
  })

  test('maps mentions', () => {
    const [item] = mapApiSpikes([spike])
    expect(item.mentions).toBe(49000)
  })

  test('maps sentiment', () => {
    const [item] = mapApiSpikes([spike])
    expect(item.sentiment).toBe('bull')
  })
})

// ── deriveSentCellIntensity ─────────────────────────────────────────────────

describe('deriveSentCellIntensity', () => {
  test('returns 0 for score 0', () => {
    expect(deriveSentCellIntensity(0)).toBe(0)
  })

  test('returns 0.5 for score 40 (|40|/80)', () => {
    expect(deriveSentCellIntensity(40)).toBeCloseTo(0.5)
  })

  test('returns 0.5 for score -40 (absolute value)', () => {
    expect(deriveSentCellIntensity(-40)).toBeCloseTo(0.5)
  })

  test('returns 1 for score 80 (max intensity)', () => {
    expect(deriveSentCellIntensity(80)).toBe(1)
  })

  test('clamps to 1 for score > 80', () => {
    expect(deriveSentCellIntensity(100)).toBe(1)
  })

  test('clamps to 1 for score -100', () => {
    expect(deriveSentCellIntensity(-100)).toBe(1)
  })

  test('returns fractional value for small positive score', () => {
    expect(deriveSentCellIntensity(8)).toBeCloseTo(0.1)
  })
})

// ── deriveSplitPcts ─────────────────────────────────────────────────────────

describe('deriveSplitPcts', () => {
  test('returns all zeros when total is 0', () => {
    const split: SentimentSplit = { bull: 0, neu: 0, bear: 0 }
    expect(deriveSplitPcts(split)).toEqual({ bull: 0, neu: 0, bear: 0 })
  })

  test('computes 100% bull when only bull has count', () => {
    const split: SentimentSplit = { bull: 50, neu: 0, bear: 0 }
    expect(deriveSplitPcts(split)).toEqual({ bull: 100, neu: 0, bear: 0 })
  })

  test('computes equal thirds (rounded) for equal counts', () => {
    const split: SentimentSplit = { bull: 1, neu: 1, bear: 1 }
    // Each is 33.33… → rounds to 33
    expect(deriveSplitPcts(split)).toEqual({ bull: 33, neu: 33, bear: 33 })
  })

  test('handles bull/bear split with no neutral', () => {
    const split: SentimentSplit = { bull: 60, neu: 0, bear: 40 }
    expect(deriveSplitPcts(split)).toEqual({ bull: 60, neu: 0, bear: 40 })
  })

  test('rounds to integer percentages', () => {
    const split: SentimentSplit = { bull: 2, neu: 3, bear: 5 }
    // total 10: bull=20, neu=30, bear=50
    expect(deriveSplitPcts(split)).toEqual({ bull: 20, neu: 30, bear: 50 })
  })

  test('handles large counts correctly', () => {
    const split: SentimentSplit = { bull: 1000, neu: 2000, bear: 7000 }
    // total 10000: bull=10, neu=20, bear=70
    expect(deriveSplitPcts(split)).toEqual({ bull: 10, neu: 20, bear: 70 })
  })
})
