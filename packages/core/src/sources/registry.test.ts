import { describe, expect, test, vi } from 'vitest'

// Mock db/client so the SST Resource lookup doesn't fire at module load.
// registry → twitter-adapter → db/tweets → db/client (accesses Resource at import time).
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
  test('returns ["twitter"] — only twitter is implemented in Phase 1', () => {
    expect(listImplementedSources()).toEqual(['twitter'])
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
