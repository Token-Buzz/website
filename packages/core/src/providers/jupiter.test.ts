import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchJupiterPrice } from './jupiter'

const MOCK_MINT = 'So11111111111111111111111111111111111111112'

describe('fetchJupiterPrice', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses price from a valid response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          [MOCK_MINT]: { id: MOCK_MINT, type: 'derivedPrice', price: '0.0001234' },
        },
      }),
    }))

    const price = await fetchJupiterPrice(MOCK_MINT)
    expect(price).toBeCloseTo(0.0001234)
  })

  it('returns null on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))

    const price = await fetchJupiterPrice(MOCK_MINT)
    expect(price).toBeNull()
  })

  it('returns null when the mint is missing from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }))

    const price = await fetchJupiterPrice(MOCK_MINT)
    expect(price).toBeNull()
  })

  it('returns null on a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    }))

    const price = await fetchJupiterPrice(MOCK_MINT)
    expect(price).toBeNull()
  })
})
