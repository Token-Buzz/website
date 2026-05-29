import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RedditApiError,
  RETRY_DELAYS_MS,
  MAX_BACKOFF_MS,
  RATE_LIMIT_THROTTLE_THRESHOLD,
  postToRawTweet,
  encodeRedditCredential,
  decodeRedditCredential,
  validateRedditCredential,
  __resetTokenCache,
  __setSleep,
  getAccessToken,
  type RedditPost,
} from './reddit'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const basePost: RedditPost = {
  id: 'abc123',
  name: 't3_abc123',
  title: 'SOL is pumping hard today',
  selftext: '',
  created_utc: 1700000000,
  score: 42,
  ups: 42,
  num_comments: 7,
  author: 'cryptofan99',
  subreddit: 'CryptoMoonShots',
  permalink: '/r/CryptoMoonShots/comments/abc123/sol_is_pumping_hard_today/',
  url: 'https://reddit.com/r/CryptoMoonShots/comments/abc123/',
  over_18: false,
}

const TEST_CLIENT_ID = 'test-client-id'
const TEST_CLIENT_SECRET = 'test-client-secret'
const TEST_CREDENTIAL = encodeRedditCredential(TEST_CLIENT_ID, TEST_CLIENT_SECRET)

// ── postToRawTweet ────────────────────────────────────────────────────────────

describe('postToRawTweet', () => {
  it('maps id from post.id', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.id).toBe('abc123')
  })

  it('maps text as title only when selftext is empty', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.text).toBe('SOL is pumping hard today')
  })

  it('appends selftext to title with double newline when present', () => {
    const post: RedditPost = { ...basePost, selftext: 'This is the body of the post.' }
    const raw = postToRawTweet(post)
    expect(raw.text).toBe('SOL is pumping hard today\n\nThis is the body of the post.')
  })

  it('maps createdAt from created_utc epoch seconds to ISO string', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.createdAt).toBe(new Date(1700000000 * 1000).toISOString())
  })

  it('maps likeCount from score', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.likeCount).toBe(42)
  })

  it('maps replyCount from num_comments', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.replyCount).toBe(7)
  })

  it('sets retweetCount=0, quoteCount=0, viewCount=0, bookmarkCount=0', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.retweetCount).toBe(0)
    expect(raw.quoteCount).toBe(0)
    expect(raw.viewCount).toBe(0)
    expect(raw.bookmarkCount).toBe(0)
  })

  it('sets lang="en"', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.lang).toBe('en')
  })

  it('sets isReply=false', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.isReply).toBe(false)
  })

  it('maps conversationId to post.name (the t3_ prefixed fullname)', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.conversationId).toBe('t3_abc123')
  })

  it('sets inReplyToId=undefined', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.inReplyToId).toBeUndefined()
  })

  it('maps author fields from post.author', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.author.userName).toBe('cryptofan99')
    expect(raw.author.id).toBe('cryptofan99')
    expect(raw.author.name).toBe('cryptofan99')
    expect(raw.author.isBlueVerified).toBe(false)
    expect(raw.author.followers).toBe(0)
    expect(raw.author.following).toBe(0)
    expect(raw.author.statusesCount).toBe(0)
    expect(raw.author.description).toBeUndefined()
  })

  it('sets entities.hashtags=[] and entities.user_mentions=[]', () => {
    const raw = postToRawTweet(basePost)
    expect(raw.entities?.hashtags).toEqual([])
    expect(raw.entities?.user_mentions).toEqual([])
  })

  it('excludes reddit.com urls from entities.urls', () => {
    // The base post url contains 'reddit.com' — should not appear in urls
    const raw = postToRawTweet(basePost)
    expect(raw.entities?.urls).toEqual([])
  })

  it('includes external (non-reddit) url in entities.urls', () => {
    const post: RedditPost = { ...basePost, url: 'https://solana.com/news/latest' }
    const raw = postToRawTweet(post)
    expect(raw.entities?.urls).toEqual([{ expanded_url: 'https://solana.com/news/latest' }])
  })

  it('over_18 field: mapping still works for NSFW posts', () => {
    const nsfwPost: RedditPost = { ...basePost, over_18: true }
    const raw = postToRawTweet(nsfwPost)
    expect(raw.id).toBe('abc123')
    expect(raw.text).toBe('SOL is pumping hard today')
  })

  it('uses ups as fallback when score would be falsy (0)', () => {
    const post: RedditPost = { ...basePost, score: 0, ups: 5 }
    const raw = postToRawTweet(post)
    // score is 0 (falsy) → score ?? ups ?? 0 still returns 0 since ?? only skips null/undefined
    // The spec says: post.score ?? post.ups ?? 0; score=0 is NOT null/undefined so result is 0
    expect(raw.likeCount).toBe(0)
  })
})

// ── RedditApiError ────────────────────────────────────────────────────────────

describe('RedditApiError', () => {
  it('carries the upstream HTTP status code', () => {
    const err = new RedditApiError('Reddit API error: 429 Too Many Requests', 429)
    expect(err.status).toBe(429)
    expect(err.name).toBe('RedditApiError')
    expect(err.message).toBe('Reddit API error: 429 Too Many Requests')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof RedditApiError).toBe(true)
  })
})

// ── encodeRedditCredential / decodeRedditCredential ───────────────────────────

describe('encodeRedditCredential', () => {
  test('round-trip: encode then decode returns original values', () => {
    const encoded = encodeRedditCredential('myClientId', 'myClientSecret')
    const decoded = decodeRedditCredential(encoded)
    expect(decoded.clientId).toBe('myClientId')
    expect(decoded.clientSecret).toBe('myClientSecret')
  })

  test('produces valid JSON string', () => {
    const encoded = encodeRedditCredential('id123', 'secret456')
    expect(() => JSON.parse(encoded)).not.toThrow()
    const parsed = JSON.parse(encoded)
    expect(parsed.clientId).toBe('id123')
    expect(parsed.clientSecret).toBe('secret456')
  })
})

describe('decodeRedditCredential', () => {
  test('throws RedditApiError(500) on non-JSON input', () => {
    expect(() => decodeRedditCredential('not-json')).toThrow(RedditApiError)
    try {
      decodeRedditCredential('not-json')
    } catch (e) {
      expect((e as RedditApiError).status).toBe(500)
    }
  })

  test('throws RedditApiError(500) when clientId is missing', () => {
    const bad = JSON.stringify({ clientSecret: 'secret' })
    expect(() => decodeRedditCredential(bad)).toThrow(RedditApiError)
  })

  test('throws RedditApiError(500) when clientSecret is missing', () => {
    const bad = JSON.stringify({ clientId: 'id' })
    expect(() => decodeRedditCredential(bad)).toThrow(RedditApiError)
  })

  test('throws RedditApiError(500) when clientId is empty string', () => {
    const bad = JSON.stringify({ clientId: '', clientSecret: 'secret' })
    expect(() => decodeRedditCredential(bad)).toThrow(RedditApiError)
  })

  test('throws RedditApiError(500) when clientSecret is empty string', () => {
    const bad = JSON.stringify({ clientId: 'id', clientSecret: '' })
    expect(() => decodeRedditCredential(bad)).toThrow(RedditApiError)
  })

  test('throws RedditApiError(500) on empty string input', () => {
    expect(() => decodeRedditCredential('')).toThrow(RedditApiError)
  })

  test('throws RedditApiError(500) on JSON null', () => {
    expect(() => decodeRedditCredential('null')).toThrow(RedditApiError)
  })
})

// ── validateRedditCredential ──────────────────────────────────────────────────

describe('validateRedditCredential', () => {
  beforeEach(() => {
    __resetTokenCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns ok=true and last4=clientId.slice(-4) when token fetch succeeds', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 }),
    )

    const result = await validateRedditCredential('myClientId1234', 'mySecret')
    expect(result.ok).toBe(true)
    expect(result.last4).toBe('1234')
  })

  test('returns ok=false on 401 (invalid credentials)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    )

    const result = await validateRedditCredential('id-ending-ABCD', 'wrong-secret')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('ABCD')
  })

  test('returns ok=false on 403', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
    )

    const result = await validateRedditCredential('myId', 'badSecret')
    expect(result.ok).toBe(false)
  })

  test('re-throws on 500 (transient server error)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    )

    await expect(validateRedditCredential('myId', 'mySecret')).rejects.toBeInstanceOf(RedditApiError)
  })
})

// ── Per-clientId token cache isolation ───────────────────────────────────────

describe('token cache isolation', () => {
  beforeEach(() => {
    __resetTokenCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('two different clientIds each fetch their own token', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-for-user-A', expires_in: 3600 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-for-user-B', expires_in: 3600 }), { status: 200 }),
      )

    const tokenA = await getAccessToken('clientIdA', 'secretA')
    const tokenB = await getAccessToken('clientIdB', 'secretB')

    expect(tokenA).toBe('token-for-user-A')
    expect(tokenB).toBe('token-for-user-B')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('same clientId reuses cached token on second call', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'cached-token', expires_in: 3600 }), { status: 200 }),
    )

    const token1 = await getAccessToken('sameClientId', 'secret')
    const token2 = await getAccessToken('sameClientId', 'secret')

    expect(token1).toBe('cached-token')
    expect(token2).toBe('cached-token')
    // Only one fetch — second call hits cache
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('user A token is not visible to user B (cache keyed by clientId)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    // User A fetches
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'token-A', expires_in: 3600 }), { status: 200 }),
    )
    // User B must fetch their own
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'token-B', expires_in: 3600 }), { status: 200 }),
    )

    const tokenA = await getAccessToken('userA-client', 'secretA')
    // userB-client is different — must fetch separately
    const tokenB = await getAccessToken('userB-client', 'secretB')

    expect(tokenA).not.toBe(tokenB)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ── searchPosts: token fetch + caching, pagination, requestCount ──────────────

// Helper: build a minimal valid Reddit listing JSON body
function makeListingBody(
  posts: Partial<RedditPost>[],
  after: string | null = null,
): string {
  const children = posts.map((p) => ({
    kind: 't3',
    data: { ...basePost, ...p },
  }))
  return JSON.stringify({ data: { children, after } })
}

function makeResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeTokenResponse(): Response {
  return makeResponse(
    200,
    JSON.stringify({ access_token: 'test-token-xyz', expires_in: 3600 }),
  )
}

/** Build a response carrying Reddit rate-limit headers. */
function makeResponseWithHeaders(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('searchPosts', () => {
  let restoreSleep: ((ms: number) => Promise<void>) | undefined

  beforeEach(() => {
    // Clear token cache so each test starts fresh
    __resetTokenCache()
    // Zero out delays
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0)
    vi.stubGlobal('fetch', vi.fn())
    restoreSleep = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Restore sleep seam if it was replaced in this test
    if (restoreSleep !== undefined) {
      __setSleep(restoreSleep)
      restoreSleep = undefined
    }
  })

  test('fetches a token then performs a search and returns posts', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse()) // token fetch
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([{ id: 'post1' }]))) // search

    const { posts, requestCount } = await import('./reddit').then((m) =>
      m.searchPosts(TEST_CREDENTIAL, 'solana'),
    )

    expect(posts).toHaveLength(1)
    expect(posts[0].id).toBe('post1')
    expect(requestCount).toBe(1) // only the search request, not the token
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('caches token: second searchPosts call does not re-request the token', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse()) // token fetch (only once)
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([]))) // search 1
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([]))) // search 2

    const mod = await import('./reddit')
    await mod.searchPosts(TEST_CREDENTIAL, 'solana')
    await mod.searchPosts(TEST_CREDENTIAL, 'bitcoin')

    // Only 1 token call + 2 search calls = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  test('paginates via after cursor and returns combined posts', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(
        makeResponse(200, makeListingBody([{ id: 'p1' }, { id: 'p2' }], 't3_p2')),
      )
      .mockResolvedValueOnce(
        makeResponse(200, makeListingBody([{ id: 'p3' }], null)),
      )

    const mod = await import('./reddit')
    const { posts, requestCount } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 3 })

    expect(posts).toHaveLength(3)
    expect(posts.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(requestCount).toBe(2)
  })

  test('stops pagination at maxPages even when after cursor is present', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(
        makeResponse(200, makeListingBody([{ id: 'p1' }], 't3_p1')),
      )

    const mod = await import('./reddit')
    const { posts, requestCount } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 1 })

    expect(posts).toHaveLength(1)
    expect(requestCount).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(2) // token + 1 search
  })

  test('4xx throws RedditApiError immediately without retry', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeResponse(403, 'Forbidden'))

    const mod = await import('./reddit')

    await expect(mod.searchPosts(TEST_CREDENTIAL, 'solana')).rejects.toBeInstanceOf(mod.RedditApiError)
    // 1 token + 1 search (no retry for 4xx)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('5xx retries per RETRY_DELAYS_MS then throws RedditApiError', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeResponse(503, 'Service Unavailable'))

    const mod = await import('./reddit')
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0)

    let caughtError: unknown
    try {
      await mod.searchPosts(TEST_CREDENTIAL, 'solana')
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(mod.RedditApiError)
    expect((caughtError as InstanceType<typeof mod.RedditApiError>).status).toBe(503)
    // 1 token + 3 search attempts (1 initial + 2 retries)
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  test('malformed credential throws RedditApiError with status 500 before any network call', async () => {
    const mockFetch = vi.mocked(global.fetch)

    const mod = await import('./reddit')

    let caughtError: unknown
    try {
      await mod.searchPosts('not-valid-json', 'solana')
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(mod.RedditApiError)
    expect((caughtError as InstanceType<typeof mod.RedditApiError>).status).toBe(500)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('requestCount reflects actual search requests made (one page)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([])))

    const mod = await import('./reddit')
    const { requestCount } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 1 })

    expect(requestCount).toBe(1)
  })

  // ── 429 rate-limit handling ──────────────────────────────────────────────────

  test('(a) 429 with Retry-After retries then succeeds; sleeps for Retry-After ms', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(
        makeResponseWithHeaders(429, '', { 'Retry-After': '1' }),
      )
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([{ id: 'post1' }])))

    const mod = await import('./reddit')
    const { posts, requestCount } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 1 })

    expect(posts).toHaveLength(1)
    expect(requestCount).toBe(2) // 1 x 429 + 1 x 200
    // Slept for Retry-After: 1 s → 1000 ms (not capped)
    expect(sleepFn).toHaveBeenCalledWith(1000)
  })

  test('(b) 429 without Retry-After falls back to RETRY_DELAYS_MS backoff and retries', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    // RETRY_DELAYS_MS is already [0, 0] from beforeEach
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(makeResponseWithHeaders(429, ''))
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([{ id: 'post2' }])))

    const mod = await import('./reddit')
    const { posts, requestCount } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 1 })

    expect(posts).toHaveLength(1)
    expect(requestCount).toBe(2) // 1 x 429 + 1 x 200
    // No Retry-After → fell back to RETRY_DELAYS_MS[0] = 0 ms
    expect(sleepFn).toHaveBeenCalledWith(0)
  })

  test('(c) persistent 429 beyond retry budget throws RedditApiError with status 429', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeResponseWithHeaders(429, 'Too Many Requests'))

    const mod = await import('./reddit')

    let caughtError: unknown
    try {
      await mod.searchPosts(TEST_CREDENTIAL, 'solana')
    } catch (e) {
      caughtError = e
    }

    expect(caughtError).toBeInstanceOf(mod.RedditApiError)
    expect((caughtError as InstanceType<typeof mod.RedditApiError>).status).toBe(429)
    // 1 initial attempt + RETRY_DELAYS_MS.length retries = 3 search requests (RETRY_DELAYS_MS = [0, 0])
    // token + 3 search = 4 total fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  test('(d) Retry-After larger than MAX_BACKOFF_MS is clamped to MAX_BACKOFF_MS', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    // Retry-After of 999 seconds >> MAX_BACKOFF_MS (60 s = 60_000 ms)
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(
        makeResponseWithHeaders(429, '', { 'Retry-After': '999' }),
      )
      .mockResolvedValueOnce(makeResponse(200, makeListingBody([])))

    const mod = await import('./reddit')
    await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 1 })

    // 999 000 ms clamped to MAX_BACKOFF_MS
    expect(sleepFn).toHaveBeenCalledWith(MAX_BACKOFF_MS)
    expect(sleepFn).not.toHaveBeenCalledWith(999_000)
  })

  // ── Proactive self-throttle ──────────────────────────────────────────────────

  test('(e) throttle sleep fires when X-Ratelimit-Remaining <= threshold between pages', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    // Page 1: remaining=1 (≤ RATE_LIMIT_THROTTLE_THRESHOLD=2), reset=2 s, has after cursor
    // Page 2: ok, no cursor
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(
        makeResponseWithHeaders(
          200,
          makeListingBody([{ id: 'p1' }], 't3_p1'),
          { 'X-Ratelimit-Remaining': '1', 'X-Ratelimit-Reset': '2' },
        ),
      )
      .mockResolvedValueOnce(
        makeResponseWithHeaders(
          200,
          makeListingBody([{ id: 'p2' }], null),
          { 'X-Ratelimit-Remaining': '0', 'X-Ratelimit-Reset': '1' },
        ),
      )

    const mod = await import('./reddit')
    const { posts } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 3 })

    expect(posts).toHaveLength(2)
    // Throttle sleep: min(2 × 1000, MAX_BACKOFF_MS) = 2000 ms
    expect(sleepFn).toHaveBeenCalledWith(2000)
  })

  test('(f) no throttle sleep when X-Ratelimit-Remaining is above threshold', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    // Page 1: remaining=50 (well above threshold=2), has after cursor
    // Page 2: ok, no cursor
    mockFetch
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValueOnce(
        makeResponseWithHeaders(
          200,
          makeListingBody([{ id: 'p1' }], 't3_p1'),
          { 'X-Ratelimit-Remaining': '50', 'X-Ratelimit-Reset': '5' },
        ),
      )
      .mockResolvedValueOnce(
        makeResponseWithHeaders(
          200,
          makeListingBody([{ id: 'p2' }], null),
          { 'X-Ratelimit-Remaining': '49', 'X-Ratelimit-Reset': '5' },
        ),
      )

    const mod = await import('./reddit')
    const { posts } = await mod.searchPosts(TEST_CREDENTIAL, 'solana', { maxPages: 3 })

    expect(posts).toHaveLength(2)
    // No throttle sleep should have been called
    expect(sleepFn).not.toHaveBeenCalled()
  })
})
