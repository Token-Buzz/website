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

import { retryAfterSeconds } from './rate-limit'
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
