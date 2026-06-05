import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CryptoCompareApiError, validateKey, fetchNews, RETRY_DELAYS_MS } from './cryptocompare'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── CryptoCompareApiError ─────────────────────────────────────────────────────

describe('CryptoCompareApiError', () => {
  it('carries the numeric status and sets name correctly', () => {
    const err = new CryptoCompareApiError('something went wrong', 503)
    expect(err.status).toBe(503)
    expect(err.name).toBe('CryptoCompareApiError')
    expect(err.message).toBe('something went wrong')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof CryptoCompareApiError).toBe(true)
  })
})

// ── validateKey ───────────────────────────────────────────────────────────────

describe('validateKey (CryptoCompare)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns ok=true and correct last4 when API returns 200 with Response != "Error"', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [{ id: '1', title: 'Bitcoin news' }],
      }),
    )

    const result = await validateKey('valid-api-key-ABCD')
    expect(result.ok).toBe(true)
    expect(result.last4).toBe('ABCD')
  })

  test('returns ok=false when API returns 200 with Response="Error" (bad key)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Error',
        Message: 'You are over your rate limit please upgrade your account!',
      }),
    )

    const result = await validateKey('bad-key-WXYZ')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('WXYZ')
  })

  test('returns ok=false on 401', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(401, 'Unauthorized', 'Unauthorized'))

    const result = await validateKey('bad-key-1234')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('1234')
  })

  test('returns ok=false on 403', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(403, 'Forbidden', 'Forbidden'))

    const result = await validateKey('bad-key-EFGH')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('EFGH')
  })

  test('throws CryptoCompareApiError on 5xx', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(500, 'Internal Server Error', 'Internal Server Error'),
    )

    await expect(validateKey('some-key-QRST')).rejects.toBeInstanceOf(CryptoCompareApiError)
  })

  test('re-throws on network failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(validateKey('some-key-NETW')).rejects.toThrow('fetch failed')
  })
})

// ── fetchNews ─────────────────────────────────────────────────────────────────

describe('fetchNews (CryptoCompare)', () => {
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

  test('normalizes a 200 Data response correctly', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const publishedOn = 1705320000 // unix seconds
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          {
            id: 42,
            guid: 'guid-abc',
            url: 'https://example.com/article',
            title: '  Ethereum Update  ',
            body: '  The  network  upgrade  went  live  ',
            published_on: publishedOn,
            source_info: { name: 'CoinDesk' },
          },
        ],
      }),
    )

    const articles = await fetchNews('cc-testkey1234')
    expect(articles).toHaveLength(1)
    const a = articles[0]
    expect(a.guid).toBe('guid-abc')
    expect(a.link).toBe('https://example.com/article')
    expect(a.title).toBe('Ethereum Update')
    expect(a.summary).toBe('The network upgrade went live')
    expect(a.publishedAt).toBe(new Date(publishedOn * 1000).toISOString())
    expect(a.sourceName).toBe('CoinDesk')
  })

  test('falls back guid to String(id) when guid field is missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          {
            id: 99,
            url: 'https://example.com',
            title: 'Test',
            published_on: 1705320000,
          },
        ],
      }),
    )

    const articles = await fetchNews('cc-key1234')
    expect(articles[0].guid).toBe('99')
  })

  test('falls back guid to url when guid and id are missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          {
            url: 'https://example.com/fallback',
            title: 'Test',
            published_on: 1705320000,
          },
        ],
      }),
    )

    const articles = await fetchNews('cc-key1234')
    expect(articles[0].guid).toBe('https://example.com/fallback')
  })

  test('falls back sourceName to source field, then "CryptoCompare"', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(
        makeResponse(200, {
          Response: 'Success',
          Data: [
            {
              url: 'https://a.com',
              title: 'Test',
              published_on: 1705320000,
              source: 'cryptoblog',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(200, {
          Response: 'Success',
          Data: [
            {
              url: 'https://b.com',
              title: 'Test',
              published_on: 1705320000,
            },
          ],
        }),
      )

    const a1 = await fetchNews('cc-key1234')
    expect(a1[0].sourceName).toBe('cryptoblog')

    const a2 = await fetchNews('cc-key1234')
    expect(a2[0].sourceName).toBe('CryptoCompare')
  })

  test('caps summary to 500 chars', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const longBody = 'B'.repeat(600)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          {
            url: 'https://example.com',
            title: 'Long body',
            body: longBody,
            published_on: 1705320000,
          },
        ],
      }),
    )

    const articles = await fetchNews('cc-key1234')
    expect(articles[0].summary).toHaveLength(500)
  })

  test('published_on * 1000 is used as the timestamp (unix seconds → ms)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const publishedOn = 1000000000 // well-known unix timestamp
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          {
            url: 'https://example.com',
            title: 'Timestamp test',
            published_on: publishedOn,
          },
        ],
      }),
    )

    const articles = await fetchNews('cc-key1234')
    expect(articles[0].publishedAt).toBe(new Date(publishedOn * 1000).toISOString())
  })

  test('falls back publishedAt to now when published_on is missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    const before = Date.now()
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          {
            url: 'https://example.com',
            title: 'No timestamp',
          },
        ],
      }),
    )

    const articles = await fetchNews('cc-key1234')
    const after = Date.now()
    const ts = new Date(articles[0].publishedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  test('Response:"Error" (HTTP 200) throws CryptoCompareApiError with status 401', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Error',
        Message: 'Invalid API key.',
      }),
    )

    const err = await fetchNews('cc-badkey1234').catch((e) => e)
    expect(err).toBeInstanceOf(CryptoCompareApiError)
    expect(err.status).toBe(401)
  })

  test('returns [] when Data array is missing', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { Response: 'Success' }),
    )

    const articles = await fetchNews('cc-key1234')
    expect(articles).toHaveLength(0)
  })

  test('skips items with no url', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, {
        Response: 'Success',
        Data: [
          { title: 'No URL item', published_on: 1705320000 },
          { url: 'https://example.com', title: 'Has URL', published_on: 1705320000 },
        ],
      }),
    )

    const articles = await fetchNews('cc-key1234')
    expect(articles).toHaveLength(1)
    expect(articles[0].link).toBe('https://example.com')
  })

  test('4xx throws CryptoCompareApiError immediately (no retry)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(403, 'Forbidden', 'Forbidden'))

    await expect(fetchNews('cc-badkey1234')).rejects.toBeInstanceOf(CryptoCompareApiError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('one network failure then success → retries and returns articles', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(
        makeResponse(200, {
          Response: 'Success',
          Data: [
            {
              url: 'https://example.com',
              title: 'Retry worked',
              published_on: 1705320000,
              source_info: { name: 'Site' },
            },
          ],
        }),
      )

    const articles = await fetchNews('cc-key1234')
    expect(articles).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('5xx then success → retries and returns articles', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(makeResponse(502, 'Bad Gateway', 'Bad Gateway'))
      .mockResolvedValueOnce(
        makeResponse(200, {
          Response: 'Success',
          Data: [
            {
              url: 'https://example.com',
              title: '5xx retry',
              published_on: 1705320000,
            },
          ],
        }),
      )

    const articles = await fetchNews('cc-key1234')
    expect(articles).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('all retries exhausted on 5xx → throws CryptoCompareApiError', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValue(makeResponse(500, 'Internal Server Error', 'Internal Server Error'))

    await expect(fetchNews('cc-key1234')).rejects.toBeInstanceOf(CryptoCompareApiError)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})
