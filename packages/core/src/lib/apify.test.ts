import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ApifyApiError,
  RETRY_DELAYS_MS,
  validateApifyToken,
  runActorSync,
  __setSleep,
} from './apify'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── ApifyApiError ─────────────────────────────────────────────────────────────

describe('ApifyApiError', () => {
  it('carries the numeric status and sets name correctly', () => {
    const err = new ApifyApiError('something went wrong', 429)
    expect(err.status).toBe(429)
    expect(err.name).toBe('ApifyApiError')
    expect(err.message).toBe('something went wrong')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof ApifyApiError).toBe(true)
  })
})

// ── validateApifyToken ────────────────────────────────────────────────────────

describe('validateApifyToken', () => {
  beforeEach(() => {
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns ok=true and last4 when /users/me succeeds', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'user1', username: 'testuser' }))

    const result = await validateApifyToken('apify_token_ABCD')
    expect(result.ok).toBe(true)
    expect(result.last4).toBe('ABCD')
  })

  test('returns ok=false on 401', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(401, 'Unauthorized', 'Unauthorized'))

    const result = await validateApifyToken('apify_bad_token_WXYZ')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('WXYZ')
  })

  test('returns ok=false on 403', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(403, 'Forbidden', 'Forbidden'))

    const result = await validateApifyToken('apify_token_EFGH')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('EFGH')
  })

  test('re-throws ApifyApiError on 500 (transient server error)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(500, 'Internal Server Error', 'Internal Server Error'),
    )

    await expect(validateApifyToken('apify_token_1234')).rejects.toBeInstanceOf(ApifyApiError)
  })

  test('re-throws on network failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(validateApifyToken('apify_token_NETW')).rejects.toThrow('fetch failed')
  })
})

// ── runActorSync ──────────────────────────────────────────────────────────────

describe('runActorSync', () => {
  let restoreSleep: ((ms: number) => Promise<void>) | undefined

  beforeEach(() => {
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0)
    vi.stubGlobal('fetch', vi.fn())
    restoreSleep = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (restoreSleep !== undefined) {
      __setSleep(restoreSleep)
      restoreSleep = undefined
    }
  })

  test('returns dataset items array on 200', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const items = [{ id: 'tweet1', text: 'hello' }, { id: 'tweet2', text: 'world' }]
    mockFetch.mockResolvedValueOnce(makeResponse(200, items))

    const result = await runActorSync('tok', 'apidojo~tweet-scraper', { searchTerms: ['solana'] })
    expect(result).toEqual(items)
    expect(result).toHaveLength(2)
  })

  test('returns dataset items array on 201', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const items = [{ id: 'item1' }]
    mockFetch.mockResolvedValueOnce(makeResponse(201, items))

    const result = await runActorSync('tok', 'apidojo~tweet-scraper', { searchTerms: ['btc'] })
    expect(result).toEqual(items)
  })

  test('throws ApifyApiError with status 408 on timeout response', async () => {
    const mockFetch = vi.mocked(global.fetch)
    // Two separate calls → two mock responses required
    mockFetch.mockResolvedValueOnce(makeResponse(408, 'Request Timeout', 'Request Timeout'))
    mockFetch.mockResolvedValueOnce(makeResponse(408, 'Request Timeout', 'Request Timeout'))

    await expect(
      runActorSync('tok', 'apidojo~tweet-scraper', { searchTerms: ['eth'] }),
    ).rejects.toMatchObject({ status: 408 })

    const err = await runActorSync('tok', 'apidojo~tweet-scraper', { searchTerms: ['eth'] }).catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(ApifyApiError)
    expect(err.status).toBe(408)
  })

  test('throws ApifyApiError with status 401 immediately (no retry)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(makeResponse(401, 'Unauthorized', 'Unauthorized'))

    await expect(
      runActorSync('bad-token', 'apidojo~tweet-scraper', { searchTerms: ['sol'] }),
    ).rejects.toBeInstanceOf(ApifyApiError)

    // 401 should not be retried — only 1 fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('throws ApifyApiError with status 403 immediately (no retry)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(makeResponse(403, 'Forbidden', 'Forbidden'))

    const err = await runActorSync('tok', 'apidojo~tweet-scraper', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApifyApiError)
    expect(err.status).toBe(403)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('5xx is retried per RETRY_DELAYS_MS then throws ApifyApiError', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(makeResponse(503, 'Service Unavailable', 'Service Unavailable'))

    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    const err = await runActorSync('tok', 'apidojo~tweet-scraper', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApifyApiError)
    expect(err.status).toBe(503)
    // RETRY_DELAYS_MS = [0, 0] → 1 initial + 2 retries = 3 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(sleepFn).toHaveBeenCalledTimes(2)
  })

  test('5xx succeeds on retry after initial failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const items = [{ id: 'ok' }]
    mockFetch
      .mockResolvedValueOnce(makeResponse(500, 'Internal Server Error', 'Internal Server Error'))
      .mockResolvedValueOnce(makeResponse(200, items))

    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    const result = await runActorSync('tok', 'apidojo~tweet-scraper', {})
    expect(result).toEqual(items)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenCalledTimes(1)
  })

  test('network error is retried then re-thrown', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))

    const sleepFn = vi.fn().mockResolvedValue(undefined)
    restoreSleep = __setSleep(sleepFn)

    await expect(runActorSync('tok', 'apidojo~tweet-scraper', {})).rejects.toThrow('fetch failed')
    // RETRY_DELAYS_MS = [0, 0] → 1 initial + 2 retries = 3 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  test('includes timeout query param when opts.timeoutSecs is provided', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(200, []))

    await runActorSync('tok', 'apidojo~tweet-scraper', {}, { timeoutSecs: 120 })

    const calledUrl = (mockFetch.mock.calls[0][0] as string)
    expect(calledUrl).toContain('timeout=120')
  })

  test('URL-encodes actorId with ~ and / characters', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(200, []))

    // 'apidojo/tweet-scraper' should be encoded in the path
    await runActorSync('tok', 'apidojo/tweet-scraper', {})

    const calledUrl = (mockFetch.mock.calls[0][0] as string)
    // The '/' in the actor id should be percent-encoded
    expect(calledUrl).toContain('apidojo%2Ftweet-scraper')
  })

  test('uses Authorization: Bearer header', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(200, []))

    await runActorSync('my-apify-token', 'apidojo~tweet-scraper', {})

    const calledInit = mockFetch.mock.calls[0][1] as RequestInit
    expect((calledInit.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer my-apify-token',
    )
  })
})
