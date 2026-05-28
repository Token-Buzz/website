/**
 * Pure unit tests for rate-limit helpers.
 * No DynamoDB access — these tests run in the unit suite (vitest.config.ts).
 *
 * client.ts is mocked so the SST Resource lookup does not fire at module load.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock client.ts before importing rate-limit (which imports client.ts).
vi.mock('./client', () => ({
  ddb: {},
  TableNames: { aggregates: 'Aggregates', tokens: 'Tokens', tweets: 'Tweets', userData: 'UserData' },
}))

import {
  retryAfterSeconds,
  warnThreshold,
  nearLimit,
  buildRateLimitEmf,
  RATE_LIMIT_METRIC_NAMESPACE,
  RATE_LIMIT_METRIC_NAME,
  RATE_LIMIT_METRIC_DIMENSION,
} from './rate-limit'
import { rateLimitKey } from './keys'

describe('retryAfterSeconds', () => {
  it('returns 60 at exactly :00 seconds past the minute', () => {
    const nowMs = new Date('2026-01-01T00:00:00.000Z').getTime()
    expect(retryAfterSeconds(nowMs)).toBe(60)
  })

  it('returns 30 at :30 seconds past the minute', () => {
    const nowMs = new Date('2026-01-01T00:00:30.000Z').getTime()
    expect(retryAfterSeconds(nowMs)).toBe(30)
  })

  it('returns 1 at :59 seconds past the minute', () => {
    const nowMs = new Date('2026-01-01T00:00:59.000Z').getTime()
    expect(retryAfterSeconds(nowMs)).toBe(1)
  })

  it('defaults to Date.now() when no argument provided', () => {
    const result = retryAfterSeconds()
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(60)
  })
})

describe('rateLimitKey', () => {
  it('produces correct pk and sk format', () => {
    const key = rateLimitKey('geckoterminal', '2026-01-01T00:00')
    expect(key).toEqual({
      pk: 'RATELIMIT#geckoterminal',
      sk: 'MINUTE#2026-01-01T00:00',
    })
  })

  it('encodes provider name correctly in pk', () => {
    const key = rateLimitKey('jupiter', '2026-06-15T08:45')
    expect(key.pk).toBe('RATELIMIT#jupiter')
  })

  it('encodes minute string correctly in sk', () => {
    const key = rateLimitKey('coingecko', '2026-12-25T23:59')
    expect(key.sk).toBe('MINUTE#2026-12-25T23:59')
  })
})

describe('warnThreshold', () => {
  it('returns 20 for limit 25 (GeckoTerminal)', () => {
    expect(warnThreshold(25)).toBe(20)
  })

  it('returns 48 for limit 60 (Jupiter)', () => {
    expect(warnThreshold(60)).toBe(48)
  })
})

describe('nearLimit', () => {
  it('returns false when count is below the warn threshold (limit 25)', () => {
    expect(nearLimit(19, 25)).toBe(false)
  })

  it('returns true at exactly the warn threshold (limit 25)', () => {
    expect(nearLimit(20, 25)).toBe(true)
  })

  it('returns true at the hard limit (limit 25)', () => {
    expect(nearLimit(25, 25)).toBe(true)
  })

  it('returns true when count exceeds the hard limit (limit 25)', () => {
    expect(nearLimit(26, 25)).toBe(true)
  })

  it('returns false when count is below the warn threshold (limit 60)', () => {
    expect(nearLimit(47, 60)).toBe(false)
  })

  it('returns true at exactly the warn threshold (limit 60)', () => {
    expect(nearLimit(48, 60)).toBe(true)
  })
})

describe('buildRateLimitEmf', () => {
  const nowMs = 1_700_000_000_000
  const provider = 'geckoterminal'
  const count = 21

  it('sets _aws.Timestamp to the provided nowMs', () => {
    const emf = buildRateLimitEmf(provider, count, nowMs)
    const aws = emf._aws as { Timestamp: number }
    expect(aws.Timestamp).toBe(nowMs)
  })

  it('sets the correct metric namespace', () => {
    const emf = buildRateLimitEmf(provider, count, nowMs)
    const metrics = (emf._aws as { CloudWatchMetrics: Array<{ Namespace: string }> })
      .CloudWatchMetrics
    expect(metrics[0].Namespace).toBe(RATE_LIMIT_METRIC_NAMESPACE)
    expect(metrics[0].Namespace).toBe('TokenBuzz/RateLimit')
  })

  it('sets Dimensions to [[Provider]]', () => {
    const emf = buildRateLimitEmf(provider, count, nowMs)
    const metrics = (
      emf._aws as { CloudWatchMetrics: Array<{ Dimensions: string[][] }> }
    ).CloudWatchMetrics
    expect(metrics[0].Dimensions).toEqual([[RATE_LIMIT_METRIC_DIMENSION]])
    expect(metrics[0].Dimensions).toEqual([['Provider']])
  })

  it('sets Metrics to [{ Name: ProviderCallsPerMin, Unit: Count }]', () => {
    const emf = buildRateLimitEmf(provider, count, nowMs)
    const metrics = (
      emf._aws as { CloudWatchMetrics: Array<{ Metrics: Array<{ Name: string; Unit: string }> }> }
    ).CloudWatchMetrics
    expect(metrics[0].Metrics).toEqual([{ Name: RATE_LIMIT_METRIC_NAME, Unit: 'Count' }])
    expect(metrics[0].Metrics).toEqual([{ Name: 'ProviderCallsPerMin', Unit: 'Count' }])
  })

  it('sets the Provider dimension value', () => {
    const emf = buildRateLimitEmf(provider, count, nowMs)
    expect(emf[RATE_LIMIT_METRIC_DIMENSION]).toBe(provider)
    expect(emf['Provider']).toBe('geckoterminal')
  })

  it('sets the ProviderCallsPerMin metric value', () => {
    const emf = buildRateLimitEmf(provider, count, nowMs)
    expect(emf[RATE_LIMIT_METRIC_NAME]).toBe(count)
    expect(emf['ProviderCallsPerMin']).toBe(21)
  })
})
