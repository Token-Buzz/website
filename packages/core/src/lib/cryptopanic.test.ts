import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CryptoPanicApiError, validateKey } from './cryptopanic'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── CryptoPanicApiError ───────────────────────────────────────────────────────

describe('CryptoPanicApiError', () => {
  it('carries the numeric status and sets name correctly', () => {
    const err = new CryptoPanicApiError('something went wrong', 503)
    expect(err.status).toBe(503)
    expect(err.name).toBe('CryptoPanicApiError')
    expect(err.message).toBe('something went wrong')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof CryptoPanicApiError).toBe(true)
  })
})

// ── validateKey ───────────────────────────────────────────────────────────────

describe('validateKey (CryptoPanic)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns ok=true and correct last4 when API returns 200 with results array', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { results: [{ id: 1, title: 'BTC news' }], next: null }),
    )

    const result = await validateKey('valid-api-key-ABCD')
    expect(result.ok).toBe(true)
    expect(result.last4).toBe('ABCD')
  })

  test('returns ok=false when API returns 200 with error body (no results array)', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { detail: 'Invalid token.' }),
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

  test('returns ok=false on 400', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(makeResponse(400, 'Bad Request', 'Bad Request'))

    const result = await validateKey('bad-key-MNOP')
    expect(result.ok).toBe(false)
    expect(result.last4).toBe('MNOP')
  })

  test('throws CryptoPanicApiError on 5xx', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(
      makeResponse(500, 'Internal Server Error', 'Internal Server Error'),
    )

    await expect(validateKey('some-key-QRST')).rejects.toBeInstanceOf(CryptoPanicApiError)
  })

  test('re-throws on network failure', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(validateKey('some-key-NETW')).rejects.toThrow('fetch failed')
  })
})
