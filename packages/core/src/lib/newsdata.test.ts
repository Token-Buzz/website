import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { NewsDataApiError, validateKey } from './newsdata'

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
