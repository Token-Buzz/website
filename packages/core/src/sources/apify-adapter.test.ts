import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Module mocks ──────────────────────────────────────────────────────────────
// Must be declared before any imports that transitively load these modules.

// Prevent SST Resource lookups from firing when db/client is imported.
vi.mock('../db/client', () => ({
  ddb: {},
  TableNames: { aggregates: 'Aggregates', tokens: 'Tokens', tweets: 'Tweets', userData: 'UserData' },
}))

vi.mock('../lib/apify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/apify')>()
  return {
    ...actual,
    runActorSync: vi.fn(),
  }
})

vi.mock('../db/tweets', () => ({
  putTweet: vi.fn(),
}))

// ── Imports (after mocks are declared) ────────────────────────────────────────

import { runActorSync, ApifyApiError } from '../lib/apify'
import { putTweet } from '../db/tweets'
import { makeApifyAdapter, APIFY_ADAPTERS } from './apify-adapter'
import { getAdapter } from './registry'
import { APIFY_ACTORS } from '../lib/apify-actors'
import type { SocialSource } from './types'

const mockRunActorSync = vi.mocked(runActorSync)
const mockPutTweet = vi.mocked(putTweet)

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Build a minimal valid apidojo tweet-scraper row for twitter. */
function makeTwitterRow(id = 'tweet-1') {
  return {
    id,
    text: `Test tweet ${id}`,
    createdAt: new Date().toISOString(),
    likeCount: 5,
    retweetCount: 1,
    replyCount: 2,
    quoteCount: 0,
    viewCount: 100,
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    author: {
      userName: 'testuser',
      id: 'uid-1',
      name: 'Test User',
      isBlueVerified: false,
      followers: 100,
      following: 50,
      statusesCount: 200,
    },
    entities: { hashtags: [], user_mentions: [], urls: [] },
  }
}

/** A row that normalize() should return null for (missing required fields). */
const invalidRow = { something: 'bad' }

// ── APIFY_ADAPTERS registry metadata ─────────────────────────────────────────

describe('APIFY_ADAPTERS registry metadata', () => {
  const sources: SocialSource[] = ['twitter', 'reddit', 'farcaster', 'telegram', 'discord']

  for (const source of sources) {
    describe(`${source}`, () => {
      const adapter = APIFY_ADAPTERS[source]!

      test('is defined', () => {
        expect(adapter).toBeDefined()
      })

      test('id matches source', () => {
        expect(adapter.id).toBe(source)
      })

      test('implemented is true', () => {
        expect(adapter.implemented).toBe(true)
      })

      test('byokProvider is "apify"', () => {
        expect(adapter.byokProvider).toBe('apify')
      })

      test('displayName contains "(Apify)"', () => {
        expect(adapter.displayName).toContain('(Apify)')
      })

      test('pollIntervalMs is 15 minutes', () => {
        expect(adapter.pollIntervalMs).toBe(15 * 60 * 1000)
      })

      test('search is a function', () => {
        expect(typeof adapter.search).toBe('function')
      })

      test('since is a function', () => {
        expect(typeof adapter.since).toBe('function')
      })
    })
  }

  test('telegram minPlan is "alpha"', () => {
    expect(APIFY_ADAPTERS.telegram!.minPlan).toBe('alpha')
  })

  test('twitter minPlan is "free"', () => {
    expect(APIFY_ADAPTERS.twitter!.minPlan).toBe('free')
  })

  test('reddit minPlan is "free"', () => {
    expect(APIFY_ADAPTERS.reddit!.minPlan).toBe('free')
  })

  test('farcaster minPlan is "free"', () => {
    expect(APIFY_ADAPTERS.farcaster!.minPlan).toBe('free')
  })

  test('discord minPlan is "free"', () => {
    expect(APIFY_ADAPTERS.discord!.minPlan).toBe('free')
  })
})

// ── makeApifyAdapter — search() ───────────────────────────────────────────────

describe('makeApifyAdapter("twitter").search', () => {
  const adapter = makeApifyAdapter('twitter')
  const twitterSpec = APIFY_ACTORS.twitter

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls runActorSync with the twitter actor id and built input', async () => {
    const rows = [makeTwitterRow('t1'), makeTwitterRow('t2')]
    mockRunActorSync.mockResolvedValueOnce(rows)
    mockPutTweet.mockResolvedValue(undefined)

    await adapter.search('apify-token', 'solana', { maxPages: 2 })

    expect(mockRunActorSync).toHaveBeenCalledOnce()
    const [token, actorId, input, opts] = mockRunActorSync.mock.calls[0]
    expect(token).toBe('apify-token')
    expect(actorId).toBe(twitterSpec.actorId)
    // maxItems = (maxPages=2) * 20 = 40
    const expectedInput = twitterSpec.buildInput('solana', { maxItems: 40 })
    expect(input).toEqual(expectedInput)
    expect(opts?.timeoutSecs).toBe(60)
  })

  it('calls putTweet for each valid normalized row', async () => {
    const rows = [makeTwitterRow('t1'), makeTwitterRow('t2'), makeTwitterRow('t3')]
    mockRunActorSync.mockResolvedValueOnce(rows)
    mockPutTweet.mockResolvedValue(undefined)

    const result = await adapter.search('apify-token', 'solana')

    expect(mockPutTweet).toHaveBeenCalledTimes(3)
    expect(result.source).toBe('twitter')
    expect(result.ingested).toBe(3)
  })

  it('skips null-normalized rows and does not call putTweet for them', async () => {
    const rows = [makeTwitterRow('t1'), invalidRow, makeTwitterRow('t3')]
    mockRunActorSync.mockResolvedValueOnce(rows)
    mockPutTweet.mockResolvedValue(undefined)

    const result = await adapter.search('apify-token', 'bitcoin')

    // invalidRow should be skipped
    expect(mockPutTweet).toHaveBeenCalledTimes(2)
    expect(result.ingested).toBe(2)
  })

  it('uses default maxPages=5 (*20=100 maxItems) when opts is not passed', async () => {
    mockRunActorSync.mockResolvedValueOnce([])

    await adapter.search('apify-token', 'ethereum')

    const [, , input] = mockRunActorSync.mock.calls[0]
    const expectedInput = twitterSpec.buildInput('ethereum', { maxItems: 100 })
    expect(input).toEqual(expectedInput)
  })

  it('returns ingested=0 on Apify 408 timeout (partial/empty, no throw)', async () => {
    mockRunActorSync.mockRejectedValueOnce(new ApifyApiError('Apify actor run timed out', 408))

    const result = await adapter.search('apify-token', 'sol')

    expect(result.source).toBe('twitter')
    expect(result.ingested).toBe(0)
    // putTweet should NOT have been called
    expect(mockPutTweet).not.toHaveBeenCalled()
  })

  it('re-throws ApifyApiError on 401 (invalid key)', async () => {
    mockRunActorSync.mockRejectedValueOnce(new ApifyApiError('Unauthorized', 401))

    await expect(adapter.search('bad-token', 'sol')).rejects.toBeInstanceOf(ApifyApiError)
  })

  it('re-throws ApifyApiError on 403 (forbidden)', async () => {
    mockRunActorSync.mockRejectedValueOnce(new ApifyApiError('Forbidden', 403))

    await expect(adapter.search('bad-token', 'sol')).rejects.toBeInstanceOf(ApifyApiError)
  })

  it('counts only fulfilled putTweet writes in ingested', async () => {
    const rows = [makeTwitterRow('t1'), makeTwitterRow('t2'), makeTwitterRow('t3')]
    mockRunActorSync.mockResolvedValueOnce(rows)
    // First write fails, other two succeed
    mockPutTweet
      .mockRejectedValueOnce(new Error('DynamoDB failure'))
      .mockResolvedValue(undefined)

    const result = await adapter.search('apify-token', 'solana')

    expect(result.ingested).toBe(2)
  })
})

// ── makeApifyAdapter — since() ────────────────────────────────────────────────

describe('makeApifyAdapter("reddit").since', () => {
  const adapter = makeApifyAdapter('reddit')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls runActorSync with maxItems=40 and timeoutSecs=60', async () => {
    mockRunActorSync.mockResolvedValueOnce([])

    await adapter.since('apify-token', 'defi')

    const [, , input, opts] = mockRunActorSync.mock.calls[0]
    const redditSpec = APIFY_ACTORS.reddit
    const expectedInput = redditSpec.buildInput('defi', { maxItems: 40 })
    expect(input).toEqual(expectedInput)
    expect(opts?.timeoutSecs).toBe(60)
  })

  it('returns { source: "reddit", ingested: 0 } when no rows are returned', async () => {
    mockRunActorSync.mockResolvedValueOnce([])

    const result = await adapter.since('apify-token', 'defi')

    expect(result.source).toBe('reddit')
    expect(result.ingested).toBe(0)
  })

  it('returns ingested=0 on 408 timeout without throwing', async () => {
    mockRunActorSync.mockRejectedValueOnce(new ApifyApiError('timed out', 408))

    const result = await adapter.since('apify-token', 'defi')

    expect(result.ingested).toBe(0)
  })
})

// ── getAdapter mode-awareness ─────────────────────────────────────────────────

describe('getAdapter with mode', () => {
  test('getAdapter("twitter") returns direct adapter with byokProvider="twitter"', () => {
    const adapter = getAdapter('twitter')
    expect(adapter).toBeDefined()
    expect(adapter?.byokProvider).toBe('twitter')
    expect(adapter?.id).toBe('twitter')
  })

  test('getAdapter("twitter", "per-source") returns direct adapter with byokProvider="twitter"', () => {
    const adapter = getAdapter('twitter', 'per-source')
    expect(adapter).toBeDefined()
    expect(adapter?.byokProvider).toBe('twitter')
  })

  test('getAdapter("twitter", "apify") returns Apify adapter with byokProvider="apify"', () => {
    const adapter = getAdapter('twitter', 'apify')
    expect(adapter).toBeDefined()
    expect(adapter?.byokProvider).toBe('apify')
    expect(adapter?.id).toBe('twitter')
  })

  test('getAdapter("reddit", "apify") returns Apify adapter', () => {
    const adapter = getAdapter('reddit', 'apify')
    expect(adapter?.byokProvider).toBe('apify')
  })

  test('getAdapter("farcaster", "apify") returns Apify adapter', () => {
    const adapter = getAdapter('farcaster', 'apify')
    expect(adapter?.byokProvider).toBe('apify')
  })

  test('getAdapter("telegram", "apify") returns Apify adapter', () => {
    const adapter = getAdapter('telegram', 'apify')
    expect(adapter?.byokProvider).toBe('apify')
  })

  test('getAdapter("discord", "apify") returns Apify adapter', () => {
    const adapter = getAdapter('discord', 'apify')
    expect(adapter?.byokProvider).toBe('apify')
  })

  test('getAdapter("bogus", "apify") returns undefined', () => {
    expect(getAdapter('bogus', 'apify')).toBeUndefined()
  })

  test('getAdapter("bogus") returns undefined', () => {
    expect(getAdapter('bogus')).toBeUndefined()
  })

  test('apify adapter id is still the source name (not "apify")', () => {
    expect(getAdapter('twitter', 'apify')?.id).toBe('twitter')
    expect(getAdapter('reddit', 'apify')?.id).toBe('reddit')
  })
})
