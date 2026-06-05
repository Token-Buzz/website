import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CryptoCompareApiError, validateKey } from './cryptocompare'

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
