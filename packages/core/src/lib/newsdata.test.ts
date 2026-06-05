import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { NewsDataApiError, validateKey, fetchNews, RETRY_DELAYS_MS } from './newsdata'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── NewsDataApiError ──────────────────────────────────────────────────────────

describe('NewsDataApiError', () => {
  it('carries the numeric status and sets name correctly', () => {
    const err = new NewsDataApiError('something went wrong', 503)
    expect(err.status).toBe(503)
    expect(err.name).toBe('NewsDataApiError')
    expect(err.message).toBe('something went wrong')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof NewsDataApiError).toBe(true)
  })
})

// ── validateKey ───────────────────────────────────────────────────────────────

describe('validateKey (NewsData.io)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns ok=true and correct last4 when API returns 200 with status:"success"', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { status: 'success', results: [{ title: 'BTC news' }] }),
    )

    const result = await validateKey('pub_validkey1234ABCD')
    expect(result.ok).toBe(true)
    expect(result.last4).toBe('ABCD')
  })

  test('returns ok=false when API returns 200 with status:"error"', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { status: 'error', message: 'Invalid api_key' }),
    )

    const result = await validateKey('pub_badkeyWXYZ')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('WXYZ')
  })

  test('returns ok=false on 401', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(401, 'Unauthorized', 'Unauthorized'))

    const result = await validateKey('pub_badkey1234')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('1234')
  })

  test('returns ok=false on 403', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(403, 'Forbidden', 'Forbidden'))

    const result = await validateKey('pub_badkeyEFGH')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('EFGH')
  })

  test('returns ok=false on 400', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(400, 'Bad Request', 'Bad Request'))

    const result = await validateKey('pub_badkeyMNOP')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('MNOP')
  })

  test('returns ok=false on 422', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(422, 'Unprocessable Entity', 'Unprocessable Entity'))

    const result = await validateKey('pub_badkeyQRST')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('QRST')
  })

  test('throws NewsDataApiError on 5xx', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(500, 'Internal Server Error', 'Internal Server Error'),
    )

    await expect(validateKey('pub_somekeyUVWX')).rejects.toBeInstanceOf(NewsDataApiError)
  })

  test('re-throws on network failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(validateKey('pub_somekeyNETW')).rejects.toThrow('fetch failed')
  })
})

// ── fetchNews ─────────────────────────────────────────────────────────────────

describe('fetchNews (NewsData.io)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Disable retry delays for tests
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Restore original delays
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 500, 1500)
  })

  test('normalizes a 200 success body correctly', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const pubDate = '2024-01-15 12:00:00'
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          {
            article_id: 'abc123',
            link: 'https://example.com/article',
            title: '  Bitcoin Surges  ',
            description: '  BTC price  hit  a new high   ',
            pubDate,
            source_name: 'CryptoNews',
          },
        ],
      }),
    )

    const articles = await fetchNews('pub_testkey1234')
    expect(articles).toHaveLength(1)
    const a = articles[0]
    expect(a.guid).toBe('abc123')
    expect(a.link).toBe('https://example.com/article')
    expect(a.title).toBe('Bitcoin Surges')
    expect(a.summary).toBe('BTC price hit a new high')
    expect(a.publishedAt).toBe(new Date(pubDate).toISOString())
    expect(a.sourceName).toBe('CryptoNews')
  })

  test('falls back sourceName to source_id when source_name missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          {
            article_id: 'abc',
            link: 'https://example.com',
            title: 'Test',
            source_id: 'cryptosite',
          },
        ],
      }),
    )

    const articles = await fetchNews('pub_key1234')
    expect(articles[0].sourceName).toBe('cryptosite')
  })

  test('falls back sourceName to "NewsData.io" when both source fields missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          {
            article_id: 'xyz',
            link: 'https://example.com',
            title: 'News',
          },
        ],
      }),
    )

    const articles = await fetchNews('pub_key1234')
    expect(articles[0].sourceName).toBe('NewsData.io')
  })

  test('caps summary to 500 chars', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const longDesc = 'A'.repeat(600)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          {
            article_id: 'cap',
            link: 'https://example.com',
            title: 'Long',
            description: longDesc,
          },
        ],
      }),
    )

    const articles = await fetchNews('pub_key1234')
    expect(articles[0].summary).toHaveLength(500)
  })

  test('falls back publishedAt to now when pubDate is missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const before = Date.now()
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          {
            article_id: 'nopub',
            link: 'https://example.com',
            title: 'No date',
          },
        ],
      }),
    )

    const articles = await fetchNews('pub_key1234')
    const after = Date.now()
    const ts = new Date(articles[0].publishedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  test('falls back publishedAt to now when pubDate is invalid', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const before = Date.now()
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          {
            article_id: 'badpub',
            link: 'https://example.com',
            title: 'Bad date',
            pubDate: 'not-a-date',
          },
        ],
      }),
    )

    const articles = await fetchNews('pub_key1234')
    const after = Date.now()
    const ts = new Date(articles[0].publishedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  test('returns [] when status !== "success"', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { status: 'error', message: 'Invalid key' }),
    )

    const articles = await fetchNews('pub_badkey1234')
    expect(articles).toHaveLength(0)
  })

  test('returns [] when results array is missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { status: 'success' }),
    )

    const articles = await fetchNews('pub_key1234')
    expect(articles).toHaveLength(0)
  })

  test('skips results with neither link nor article_id', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        status: 'success',
        results: [
          { title: 'No id or link' },
          { article_id: 'valid', link: 'https://example.com', title: 'Valid' },
        ],
      }),
    )

    const articles = await fetchNews('pub_key1234')
    expect(articles).toHaveLength(1)
    expect(articles[0].guid).toBe('valid')
  })

  test('401 throws NewsDataApiError immediately (no retry)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(401, 'Unauthorized', 'Unauthorized'))

    await expect(fetchNews('pub_badkey1234')).rejects.toBeInstanceOf(NewsDataApiError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('one network failure then success → retries and returns articles', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(
        makeResponse(200, {
          status: 'success',
          results: [
            {
              article_id: 'retry-ok',
              link: 'https://example.com',
              title: 'Retry worked',
              source_name: 'Site',
            },
          ],
        }),
      )

    const articles = await fetchNews('pub_key1234')
    expect(articles).toHaveLength(1)
    expect(articles[0].guid).toBe('retry-ok')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('5xx then success → retries and returns articles', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeResponse(503, 'Service Unavailable', 'Service Unavailable'))
      .mockResolvedValueOnce(
        makeResponse(200, {
          status: 'success',
          results: [
            {
              article_id: 'retry5xx',
              link: 'https://example.com',
              title: '5xx retry worked',
              source_name: 'Site',
            },
          ],
        }),
      )

    const articles = await fetchNews('pub_key1234')
    expect(articles).toHaveLength(1)
    expect(articles[0].guid).toBe('retry5xx')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('all retries exhausted on network error → throws', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValue(new TypeError('persistent network error'))

    await expect(fetchNews('pub_key1234')).rejects.toThrow('persistent network error')
    // 3 total attempts: initial + 2 retries
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})
