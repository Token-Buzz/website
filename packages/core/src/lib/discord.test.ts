import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DiscordApiError,
  RETRY_DELAYS_MS,
  messageToRawTweet,
  validateToken,
  searchMessages,
  __setSleep,
  type DiscordMessage,
} from './discord'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseMsg: DiscordMessage = {
  id: '1234567890123456789',
  guildId: '9876543210987654321',
  guildName: 'Crypto Trading Hub',
  channelId: '1111111111111111111',
  channelName: 'general',
  content: 'SOL just broke $200!',
  timestamp: '2024-01-15T10:30:00.000Z',
  authorId: '2222222222222222222',
  authorUsername: 'cryptotrader99',
  authorGlobalName: 'Crypto Trader',
}

// ── messageToRawTweet (pure mapper) ───────────────────────────────────────────

describe('messageToRawTweet', () => {
  it('passes the Discord snowflake id through directly', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.id).toBe('1234567890123456789')
  })

  it('maps text from content', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.text).toBe('SOL just broke $200!')
  })

  it('passes createdAt from timestamp (already ISO-8601)', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.createdAt).toBe('2024-01-15T10:30:00.000Z')
  })

  it('maps author.userName from authorUsername', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.author.userName).toBe('cryptotrader99')
  })

  it('maps author.id from authorId', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.author.id).toBe('2222222222222222222')
  })

  it('maps author.name from authorGlobalName when present', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.author.name).toBe('Crypto Trader')
  })

  it('falls back author.name to authorUsername when authorGlobalName is absent', () => {
    const msg: DiscordMessage = { ...baseMsg, authorGlobalName: undefined }
    const raw = messageToRawTweet(msg)
    expect(raw.author.name).toBe('cryptotrader99')
  })

  it('sets all engagement counts to 0', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.likeCount).toBe(0)
    expect(raw.retweetCount).toBe(0)
    expect(raw.replyCount).toBe(0)
    expect(raw.quoteCount).toBe(0)
    expect(raw.viewCount).toBe(0)
    expect(raw.bookmarkCount).toBe(0)
  })

  it('sets lang="en" and isReply=false', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.lang).toBe('en')
    expect(raw.isReply).toBe(false)
  })

  it('sets author.isBlueVerified=false, followers=0, following=0, statusesCount=0', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.author.isBlueVerified).toBe(false)
    expect(raw.author.followers).toBe(0)
    expect(raw.author.following).toBe(0)
    expect(raw.author.statusesCount).toBe(0)
  })

  it('emits empty entity arrays', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.entities).toEqual({ hashtags: [], user_mentions: [], urls: [] })
  })
})

// ── DiscordApiError ───────────────────────────────────────────────────────────

describe('DiscordApiError', () => {
  it('carries the upstream HTTP status code', () => {
    const err = new DiscordApiError('Discord API error: 429 Too Many Requests', 429)
    expect(err.status).toBe(429)
    expect(err.name).toBe('DiscordApiError')
    expect(err.message).toBe('Discord API error: 429 Too Many Requests')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof DiscordApiError).toBe(true)
  })

  it('status 0 is used for network-level errors', () => {
    const err = new DiscordApiError('Discord network error: timeout', 0)
    expect(err.status).toBe(0)
    expect(err.name).toBe('DiscordApiError')
  })
})

// ── validateToken ─────────────────────────────────────────────────────────────

describe('validateToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeFetchStub(status: number, ok: boolean): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValueOnce({
      ok,
      status,
      headers: { get: () => null },
      json: async () => ({}),
    })
  }

  test('200 → ok=true and last4 is the last 4 chars of the token', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ id: 'bot-id', username: 'MyBot' }),
    } as unknown as Response)

    const result = await validateToken('my-secret-token-ABCD')
    expect(result.ok).toBe(true)
    expect(result.last4).toBe('ABCD')
  })

  test('401 → ok=false (invalid token)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response)

    const result = await validateToken('bad-token-1234')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('1234')
  })

  test('403 → ok=false', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response)

    const result = await validateToken('forbidden-token-WXYZ')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('WXYZ')
  })

  test('other 4xx (e.g. 404) → ok=false', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response)

    const result = await validateToken('gone-token-GONE')
    expect(result.ok).toBe(false)
  })

  test('500 → throws DiscordApiError (transient server error)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response)

    await expect(validateToken('server-error-token-XYZW')).rejects.toBeInstanceOf(DiscordApiError)
  })

  test('503 → throws DiscordApiError', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response)

    await expect(validateToken('down-token-DOWN')).rejects.toBeInstanceOf(DiscordApiError)
  })
})

// ── searchMessages ────────────────────────────────────────────────────────────

describe('searchMessages', () => {
  let restoreSleep: ((ms: number) => Promise<void>) | undefined

  beforeEach(() => {
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0)
    vi.stubGlobal('fetch', vi.fn())
    restoreSleep = __setSleep(async () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (restoreSleep !== undefined) {
      __setSleep(restoreSleep)
      restoreSleep = undefined
    }
  })

  /** Build a minimal fetch-response stub */
  function makeResp(
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
  ): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : String(status),
      headers: { get: (name: string) => headers[name] ?? null },
      json: async () => body,
    } as unknown as Response
  }

  const GUILDS = [{ id: 'g1', name: 'Crypto Hub' }]
  const CHANNELS = [
    { id: 'c1', name: 'general', type: 0 },
    { id: 'c2', name: 'announcements', type: 5 },
    { id: 'c3', name: 'voice', type: 2 }, // not a text channel → skipped
  ]
  const MESSAGES_C1 = [
    { id: 'm1', content: 'SOL is pumping!', timestamp: '2024-01-01T00:00:00.000Z', author: { id: 'u1', username: 'alice', global_name: 'Alice' } },
    { id: 'm2', content: 'Nothing relevant here', timestamp: '2024-01-01T00:01:00.000Z', author: { id: 'u2', username: 'bob', global_name: undefined } },
  ]
  const MESSAGES_C2 = [
    { id: 'm3', content: 'SOL announcement: new feature', timestamp: '2024-01-01T00:02:00.000Z', author: { id: 'u3', username: 'admin', global_name: 'Admin' } },
  ]

  test('happy path: fetches guilds, channels, messages and filters by query (case-insensitive)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeResp(200, GUILDS))              // GET /users/@me/guilds
      .mockResolvedValueOnce(makeResp(200, CHANNELS))            // GET /guilds/g1/channels
      .mockResolvedValueOnce(makeResp(200, MESSAGES_C1))         // GET /channels/c1/messages
      .mockResolvedValueOnce(makeResp(200, MESSAGES_C2))         // GET /channels/c2/messages

    const results = await searchMessages('tok-ABCD', 'sol')

    // c3 (voice) was filtered out; 'm2' doesn't match 'sol'
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('m1')
    expect(results[0].content).toBe('SOL is pumping!')
    expect(results[0].guildId).toBe('g1')
    expect(results[0].guildName).toBe('Crypto Hub')
    expect(results[0].channelId).toBe('c1')
    expect(results[0].channelName).toBe('general')
    expect(results[0].authorUsername).toBe('alice')
    expect(results[0].authorGlobalName).toBe('Alice')
    expect(results[1].id).toBe('m3')
    expect(results[1].channelId).toBe('c2')
  })

  test('case-insensitive query match: "SOL" query matches "sol" in content', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const msgs = [
      { id: 'm1', content: 'sol is rising', timestamp: '2024-01-01T00:00:00.000Z', author: { id: 'u1', username: 'alice', global_name: null } },
    ]
    mockFetch
      .mockResolvedValueOnce(makeResp(200, GUILDS))
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c1', name: 'general', type: 0 }]))
      .mockResolvedValueOnce(makeResp(200, msgs))

    const results = await searchMessages('tok', 'SOL')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('m1')
  })

  test('perChannelLimit is passed as the limit query param in the messages URL', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeResp(200, GUILDS))
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c1', name: 'general', type: 0 }]))
      .mockResolvedValueOnce(makeResp(200, []))

    await searchMessages('tok', 'anything', { perChannelLimit: 75 })

    const channelMsgUrl = (vi.mocked(global.fetch).mock.calls[2][0] as string)
    expect(channelMsgUrl).toContain('limit=75')
  })

  test('skips a channel that returns 403 without aborting the whole search', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const matchingMsg = [
      { id: 'm5', content: 'sol news', timestamp: '2024-01-01T00:00:00.000Z', author: { id: 'u1', username: 'alice' } },
    ]
    mockFetch
      .mockResolvedValueOnce(makeResp(200, GUILDS))
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c1', name: 'secret', type: 0 }, { id: 'c2', name: 'public', type: 0 }]))
      .mockResolvedValueOnce(makeResp(403, { message: 'Missing Access' }))   // c1 → 403 skip
      .mockResolvedValueOnce(makeResp(200, matchingMsg))                      // c2 → success

    const results = await searchMessages('tok', 'sol')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('m5')
  })

  test('throws DiscordApiError when GET /users/@me/guilds returns 401', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResp(401, { message: 'Unauthorized' }))

    await expect(searchMessages('bad-token', 'sol')).rejects.toBeInstanceOf(DiscordApiError)
  })

  test('throws DiscordApiError when GET /users/@me/guilds returns 403', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResp(403, { message: 'Forbidden' }))

    await expect(searchMessages('bad-token', 'sol')).rejects.toBeInstanceOf(DiscordApiError)
  })

  test('skips a guild whose channel-list fetch fails with a permission error', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const twoGuilds = [{ id: 'g1', name: 'Guild One' }, { id: 'g2', name: 'Guild Two' }]
    const g2msgs = [
      { id: 'm9', content: 'sol breakout', timestamp: '2024-01-01T00:00:00.000Z', author: { id: 'u1', username: 'alice' } },
    ]
    mockFetch
      .mockResolvedValueOnce(makeResp(200, twoGuilds))
      .mockResolvedValueOnce(makeResp(403, { message: 'Missing Access' }))       // g1 channels → skip
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c5', name: 'chat', type: 0 }])) // g2 channels
      .mockResolvedValueOnce(makeResp(200, g2msgs))                               // g2/c5 messages

    const results = await searchMessages('tok', 'sol')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('m9')
  })

  test('messages with empty content are not included in results', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const msgs = [
      { id: 'm1', content: '', timestamp: '2024-01-01T00:00:00.000Z', author: { id: 'u1', username: 'alice' } },
      { id: 'm2', content: 'sol mention', timestamp: '2024-01-01T00:01:00.000Z', author: { id: 'u1', username: 'alice' } },
    ]
    mockFetch
      .mockResolvedValueOnce(makeResp(200, GUILDS))
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c1', name: 'general', type: 0 }]))
      .mockResolvedValueOnce(makeResp(200, msgs))

    const results = await searchMessages('tok', 'sol')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('m2')
  })

  test('caps guilds to maxGuilds option', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const manyGuilds = [
      { id: 'g1', name: 'G1' },
      { id: 'g2', name: 'G2' },
      { id: 'g3', name: 'G3' },
    ]
    // Only g1 and g2 channels/messages should be fetched (maxGuilds=2)
    mockFetch
      .mockResolvedValueOnce(makeResp(200, manyGuilds))
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c1', name: 'ch', type: 0 }]))  // g1
      .mockResolvedValueOnce(makeResp(200, []))                                    // g1/c1 messages
      .mockResolvedValueOnce(makeResp(200, [{ id: 'c2', name: 'ch', type: 0 }]))  // g2
      .mockResolvedValueOnce(makeResp(200, []))                                    // g2/c2 messages

    await searchMessages('tok', 'sol', { maxGuilds: 2 })

    // Total fetch calls: 1 (guilds) + 2*(1 channel list + 1 message fetch) = 5
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(5)
  })
})
