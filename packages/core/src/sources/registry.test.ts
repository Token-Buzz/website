import { describe, expect, test, vi } from 'vitest'

// Mock db/client so the SST Resource lookup doesn't fire at module load.
// registry → twitter-adapter / reddit-adapter → db/tweets / db/usage → db/client (accesses Resource at import time).
vi.mock('../db/client', () => ({
  ddb: {},
  TableNames: { aggregates: 'Aggregates', tokens: 'Tokens', tweets: 'Tweets', userData: 'UserData' },
}))

import { getAdapter, listImplementedSources, allowedSources, SOURCE_ADAPTERS } from './registry'

describe('getAdapter', () => {
  test('returns twitter adapter for "twitter"', () => {
    const adapter = getAdapter('twitter')
    expect(adapter).toBeDefined()
    expect(adapter?.id).toBe('twitter')
  })

  test('returns undefined for unknown id', () => {
    expect(getAdapter('bogus')).toBeUndefined()
  })

  test('returns undefined for empty string', () => {
    expect(getAdapter('')).toBeUndefined()
  })
})

describe('listImplementedSources', () => {
  test('returns ["twitter", "farcaster", "reddit", "telegram"] — all implemented as of Phase 4', () => {
    expect(listImplementedSources()).toEqual(['twitter', 'farcaster', 'reddit', 'telegram'])
  })
})

describe('allowedSources', () => {
  test('free plan includes twitter', () => {
    expect(allowedSources('free')).toContain('twitter')
  })

  test('pro plan includes twitter', () => {
    expect(allowedSources('pro')).toContain('twitter')
  })

  test('alpha plan includes twitter', () => {
    expect(allowedSources('alpha')).toContain('twitter')
  })

  test('free plan includes farcaster', () => {
    expect(allowedSources('free')).toContain('farcaster')
  })

  test('free plan includes reddit', () => {
    expect(allowedSources('free')).toContain('reddit')
  })

  test('pro plan includes reddit', () => {
    expect(allowedSources('pro')).toContain('reddit')
  })

  test('alpha plan includes reddit', () => {
    expect(allowedSources('alpha')).toContain('reddit')
  })

  test('alpha plan includes telegram', () => {
    expect(allowedSources('alpha')).toContain('telegram')
  })

  test('free plan does NOT include telegram', () => {
    expect(allowedSources('free')).not.toContain('telegram')
  })

  test('pro plan does NOT include telegram', () => {
    expect(allowedSources('pro')).not.toContain('telegram')
  })
})

describe('twitter adapter metadata', () => {
  const adapter = SOURCE_ADAPTERS.twitter!

  test('id is "twitter"', () => {
    expect(adapter.id).toBe('twitter')
  })

  test('displayName is "X"', () => {
    expect(adapter.displayName).toBe('X')
  })

  test('minPlan is "free"', () => {
    expect(adapter.minPlan).toBe('free')
  })

  test('pollIntervalMs is 2 minutes (120000)', () => {
    expect(adapter.pollIntervalMs).toBe(2 * 60 * 1000)
  })

  test('implemented is true', () => {
    expect(adapter.implemented).toBe(true)
  })

  test('byokProvider is "twitter"', () => {
    expect(adapter.byokProvider).toBe('twitter')
  })

  test('search is a function', () => {
    expect(typeof adapter.search).toBe('function')
  })

  test('since is a function', () => {
    expect(typeof adapter.since).toBe('function')
  })
})

describe('farcaster adapter metadata', () => {
  const adapter = SOURCE_ADAPTERS.farcaster!

  test('id is "farcaster"', () => {
    expect(adapter.id).toBe('farcaster')
  })

  test('displayName is "Farcaster"', () => {
    expect(adapter.displayName).toBe('Farcaster')
  })

  test('minPlan is "free"', () => {
    expect(adapter.minPlan).toBe('free')
  })

  test('pollIntervalMs is 2 minutes (120000)', () => {
    expect(adapter.pollIntervalMs).toBe(2 * 60 * 1000)
  })

  test('implemented is true', () => {
    expect(adapter.implemented).toBe(true)
  })

  test('byokProvider is null', () => {
    expect(adapter.byokProvider).toBeNull()
  })

  test('search is a function', () => {
    expect(typeof adapter.search).toBe('function')
  })

  test('since is a function', () => {
    expect(typeof adapter.since).toBe('function')
  })
})

describe('telegram adapter metadata', () => {
  const adapter = SOURCE_ADAPTERS.telegram!

  test('id is "telegram"', () => {
    expect(adapter.id).toBe('telegram')
  })

  test('displayName is "Telegram"', () => {
    expect(adapter.displayName).toBe('Telegram')
  })

  test('minPlan is "alpha"', () => {
    expect(adapter.minPlan).toBe('alpha')
  })

  test('pollIntervalMs is 15 minutes (900000)', () => {
    expect(adapter.pollIntervalMs).toBe(15 * 60 * 1000)
  })

  test('implemented is true', () => {
    expect(adapter.implemented).toBe(true)
  })

  test('byokProvider is "telegram"', () => {
    expect(adapter.byokProvider).toBe('telegram')
  })

  test('search is a function', () => {
    expect(typeof adapter.search).toBe('function')
  })

  test('since is a function', () => {
    expect(typeof adapter.since).toBe('function')
  })
})

describe('reddit adapter metadata', () => {
  const adapter = SOURCE_ADAPTERS.reddit!

  test('id is "reddit"', () => {
    expect(adapter.id).toBe('reddit')
  })

  test('displayName is "Reddit"', () => {
    expect(adapter.displayName).toBe('Reddit')
  })

  test('minPlan is "free"', () => {
    expect(adapter.minPlan).toBe('free')
  })

  test('pollIntervalMs is 20 minutes (1200000)', () => {
    expect(adapter.pollIntervalMs).toBe(20 * 60 * 1000)
  })

  test('implemented is true', () => {
    expect(adapter.implemented).toBe(true)
  })

  test('byokProvider is "reddit"', () => {
    expect(adapter.byokProvider).toBe('reddit')
  })

  test('search is a function', () => {
    expect(typeof adapter.search).toBe('function')
  })

  test('since is a function', () => {
    expect(typeof adapter.since).toBe('function')
  })
})
