import { describe, test, expect } from 'vitest'
import { gtTimeframe, parseSearchPools } from './geckoterminal'
import { candidateToRef } from './price'

describe('gtTimeframe', () => {
  test('5m maps to minute/5', () => {
    expect(gtTimeframe('5m')).toEqual({ timeframe: 'minute', aggregate: 5 })
  })

  test('1h maps to hour/1', () => {
    expect(gtTimeframe('1h')).toEqual({ timeframe: 'hour', aggregate: 1 })
  })

  test('4h maps to hour/4', () => {
    expect(gtTimeframe('4h')).toEqual({ timeframe: 'hour', aggregate: 4 })
  })

  test('1d maps to day/1', () => {
    expect(gtTimeframe('1d')).toEqual({ timeframe: 'day', aggregate: 1 })
  })
})

// ── parseSearchPools ────────────────────────────────────────────────────────

/** Minimal fixture matching the GeckoTerminal /search/pools response shape. */
const FIXTURE = {
  data: [
    {
      id: 'pool_low',
      type: 'pool',
      attributes: {
        address: 'PoolAddressLow111111111111111111111',
        name: 'BONK / USDC',
        base_token_price_usd: '0.00001234',
        reserve_in_usd: '500000',
        volume_usd: { h24: '120000' },
      },
      relationships: {
        base_token: { data: { id: 'solana_BonkMint111111111111111111111111111' } },
        quote_token: { data: { id: 'solana_UsdcMint111111111111111111111111111' } },
        dex: { data: { id: 'raydium' } },
      },
    },
    {
      id: 'pool_high',
      type: 'pool',
      attributes: {
        address: 'PoolAddressHigh222222222222222222222',
        name: 'BONK / SOL',
        base_token_price_usd: '0.00001300',
        reserve_in_usd: '2000000',
        // No volume_usd field — tests null handling
      },
      relationships: {
        base_token: { data: { id: 'solana_BonkMint111111111111111111111111111' } },
        quote_token: { data: { id: 'solana_SolMint111111111111111111111111111' } },
        dex: { data: { id: 'orca' } },
      },
    },
    {
      id: 'pool_null_reserve',
      type: 'pool',
      attributes: {
        address: 'PoolAddressNull333333333333333333333',
        name: 'BONK / WBTC',
        base_token_price_usd: null,
        reserve_in_usd: null,
        volume_usd: { h24: null },
      },
      relationships: {
        base_token: { data: { id: 'solana_BonkMint111111111111111111111111111' } },
        dex: { data: { id: 'unknown-dex' } },
      },
    },
  ],
  included: [
    {
      id: 'solana_BonkMint111111111111111111111111111',
      type: 'token',
      attributes: { symbol: 'BONK', name: 'Bonk', address: 'BonkMint111111111111111111111111111' },
    },
    {
      id: 'solana_UsdcMint111111111111111111111111111',
      type: 'token',
      attributes: { symbol: 'USDC', name: 'USD Coin', address: 'UsdcMint111111111111111111111111111' },
    },
    {
      id: 'solana_SolMint111111111111111111111111111',
      type: 'token',
      attributes: { symbol: 'SOL', name: 'Solana', address: 'SolMint111111111111111111111111111' },
    },
    {
      id: 'raydium',
      type: 'dex',
      attributes: { name: 'Raydium' },
    },
    // 'orca' dex NOT in included — tests fallback to id
  ],
}

describe('parseSearchPools', () => {
  test('returns empty array for null / non-object input', () => {
    expect(parseSearchPools(null)).toEqual([])
    expect(parseSearchPools(undefined)).toEqual([])
    expect(parseSearchPools('string')).toEqual([])
    expect(parseSearchPools(42)).toEqual([])
  })

  test('returns empty array when data is missing or not an array', () => {
    expect(parseSearchPools({})).toEqual([])
    expect(parseSearchPools({ data: 'not-array' })).toEqual([])
  })

  test('skips pools with no usable address', () => {
    const json = {
      data: [
        {
          type: 'pool',
          attributes: { address: '', name: 'no address' },
          relationships: { base_token: { data: { id: 'solana_SomeMint' } } },
        },
      ],
    }
    expect(parseSearchPools(json)).toEqual([])
  })

  test('skips pools with no base-token mint', () => {
    const json = {
      data: [
        {
          type: 'pool',
          attributes: { address: 'ValidPool', name: 'X / Y' },
          relationships: {},
        },
      ],
    }
    expect(parseSearchPools(json)).toEqual([])
  })

  test('sorts candidates by reserveUsd descending (nulls last)', () => {
    const candidates = parseSearchPools(FIXTURE)
    expect(candidates).toHaveLength(3)
    // pool_high has reserve 2_000_000 → first
    expect(candidates[0]!.pool).toBe('PoolAddressHigh222222222222222222222')
    // pool_low has reserve 500_000 → second
    expect(candidates[1]!.pool).toBe('PoolAddressLow111111111111111111111')
    // pool_null_reserve has null reserve → last
    expect(candidates[2]!.pool).toBe('PoolAddressNull333333333333333333333')
  })

  test('strips solana_ prefix from mint id', () => {
    const candidates = parseSearchPools(FIXTURE)
    for (const c of candidates) {
      expect(c.mint).not.toMatch(/^solana_/)
    }
    expect(candidates[0]!.mint).toBe('BonkMint111111111111111111111111111')
  })

  test('resolves baseSymbol and baseName from included entries', () => {
    const candidates = parseSearchPools(FIXTURE)
    // All three pools share the same base token (BONK)
    for (const c of candidates) {
      expect(c.baseSymbol).toBe('BONK')
      expect(c.baseName).toBe('Bonk')
    }
  })

  test('resolves quoteSymbol from included entries', () => {
    const candidates = parseSearchPools(FIXTURE)
    const high = candidates.find((c) => c.pool === 'PoolAddressHigh222222222222222222222')!
    expect(high.quoteSymbol).toBe('SOL')

    const low = candidates.find((c) => c.pool === 'PoolAddressLow111111111111111111111')!
    expect(low.quoteSymbol).toBe('USDC')

    // pool_null_reserve has no quote_token relationship
    const nullReserve = candidates.find((c) => c.pool === 'PoolAddressNull333333333333333333333')!
    expect(nullReserve.quoteSymbol).toBeNull()
  })

  test('prefers human dex name from included; falls back to id when not in included', () => {
    const candidates = parseSearchPools(FIXTURE)
    const low = candidates.find((c) => c.pool === 'PoolAddressLow111111111111111111111')!
    // 'raydium' dex IS in included with name 'Raydium'
    expect(low.dex).toBe('Raydium')

    const high = candidates.find((c) => c.pool === 'PoolAddressHigh222222222222222222222')!
    // 'orca' dex is NOT in included → falls back to id
    expect(high.dex).toBe('orca')
  })

  test('parses priceUsd and reserveUsd as floats; returns null for NaN / null values', () => {
    const candidates = parseSearchPools(FIXTURE)
    const high = candidates[0]!
    expect(high.reserveUsd).toBe(2_000_000)
    expect(high.priceUsd).toBeCloseTo(0.00001300)

    const nullReserve = candidates[2]!
    expect(nullReserve.reserveUsd).toBeNull()
    expect(nullReserve.priceUsd).toBeNull()
  })

  test('volume24hUsd is null when volume_usd is absent', () => {
    const candidates = parseSearchPools(FIXTURE)
    const high = candidates.find((c) => c.pool === 'PoolAddressHigh222222222222222222222')!
    // high pool has no volume_usd field
    expect(high.volume24hUsd).toBeNull()
  })

  test('volume24hUsd is parsed from volume_usd.h24', () => {
    const candidates = parseSearchPools(FIXTURE)
    const low = candidates.find((c) => c.pool === 'PoolAddressLow111111111111111111111')!
    expect(low.volume24hUsd).toBe(120_000)
  })

  test('sets chain to solana and source to geckoterminal', () => {
    const candidates = parseSearchPools(FIXTURE)
    for (const c of candidates) {
      expect(c.chain).toBe('solana')
      expect(c.source).toBe('geckoterminal')
    }
  })
})

// ── candidateToRef ──────────────────────────────────────────────────────────

describe('candidateToRef', () => {
  const candidate = parseSearchPools(FIXTURE)[0]! // pool_high (highest reserve)

  test('produces a TokenRef with the given symbol uppercased', () => {
    const ref = candidateToRef('bonk', candidate)
    expect(ref.symbol).toBe('BONK')
  })

  test('copies mint and pool from candidate', () => {
    const ref = candidateToRef('BONK', candidate)
    expect(ref.mint).toBe(candidate.mint)
    expect(ref.pool).toBe(candidate.pool)
  })

  test('sets chain to solana and source from candidate', () => {
    const ref = candidateToRef('BONK', candidate)
    expect(ref.chain).toBe('solana')
    expect(ref.source).toBe('geckoterminal')
  })

  test('works with mixed-case symbol input', () => {
    const ref = candidateToRef('bOnK', candidate)
    expect(ref.symbol).toBe('BONK')
  })
})
