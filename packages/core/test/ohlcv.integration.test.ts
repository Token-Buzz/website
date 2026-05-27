/**
 * OHLCV integration test — exercises the real `packages/core/src/db/ohlcv.ts`
 * functions (getOHLCV, queryCachedOhlcv, writeOhlcvBuckets, resolveRef,
 * getCachedRef) against a local dynalite DynamoDB.
 *
 * A fake PriceProvider is injected (no network or API key needed) to validate
 * the cache-through logic, ref caching, TTL assignment, and graceful
 * degradation.
 */

import { describe, expect, test } from 'vitest'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import { ohlcvKey, tokenRefKey } from '@monorepo-template/core/db/keys'
import {
  getOHLCV,
  queryCachedOhlcv,
  getCachedRef,
} from '@monorepo-template/core/db/ohlcv'
import {
  type PriceProvider,
  type OHLCVBar,
  type TokenRef,
  INTERVAL_SECONDS,
} from '@monorepo-template/core/providers/price'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Round a timestamp DOWN to the nearest interval boundary. */
function alignDown(ts: number, interval: '5m' | '1h' | '4h' | '1d'): number {
  const step = INTERVAL_SECONDS[interval]
  return Math.floor(ts / step) * step
}

/** Build a fake bar at a given aligned timestamp. */
function fakeBar(ts: number): OHLCVBar {
  return { ts, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }
}

const FAKE_REF: TokenRef = {
  symbol: 'FAKE',
  mint: 'FakeMint111111111111111111111111111111',
  pool: 'FakePool111111111111111111111111111111',
  chain: 'solana',
  source: 'fake',
}

function makeFakeProvider(bars: OHLCVBar[]): PriceProvider & { resolveCalls: number; fetchCalls: number } {
  let resolveCalls = 0
  let fetchCalls = 0
  return {
    id: 'fake',
    get resolveCalls() { return resolveCalls },
    get fetchCalls() { return fetchCalls },
    async resolve(_symbol: string): Promise<TokenRef | null> {
      resolveCalls++
      return FAKE_REF
    },
    async fetchOHLCV(_ref: TokenRef, _interval: '5m' | '1h' | '4h' | '1d', _from: number, _to: number): Promise<OHLCVBar[]> {
      fetchCalls++
      return bars
    },
  }
}

// ── Test 1: cache-through ─────────────────────────────────────────────────────

describe('cache-through', () => {
  // Use 1h interval. Pick two aligned timestamps well in the past (>1h ago from
  // any reasonable test time, so TTL behaves predictably in the TTL test).
  // Use UNIX epoch start zone for clarity: 0 and 3600.
  const INTERVAL = '1h'
  const T0 = 0
  const T1 = 3600
  const SYM = 'CTTEST' // unique symbol for this describe block

  const bars = [fakeBar(T0), fakeBar(T1)]
  let provider: ReturnType<typeof makeFakeProvider>

  test('first call invokes resolve and fetchOHLCV, writes to DDB, returns bars', async () => {
    provider = makeFakeProvider(bars)
    const result = await getOHLCV(SYM, INTERVAL, T0, T1, provider)

    expect(provider.resolveCalls).toBe(1)
    expect(provider.fetchCalls).toBe(1)
    expect(result).toHaveLength(2)
    expect(result[0]?.ts).toBe(T0)
    expect(result[1]?.ts).toBe(T1)

    // Verify rows were written to DynamoDB.
    const cached = await queryCachedOhlcv(SYM, INTERVAL, T0, T1)
    expect(cached).toHaveLength(2)
  })

  test('second call over the same range does NOT call fetchOHLCV again', async () => {
    // provider already has fetchCalls=1 from the first test above;
    // re-use to check the counter stays at 1.
    const result = await getOHLCV(SYM, INTERVAL, T0, T1, provider)

    expect(provider.fetchCalls).toBe(1) // unchanged
    expect(result).toHaveLength(2)
  })
})

// ── Test 2: ref cache ─────────────────────────────────────────────────────────

describe('ref cache', () => {
  const INTERVAL = '1h'
  const T0 = 0
  const T1 = 3600
  const SYM = 'REFTEST' // unique symbol

  test('REF row is written on first call; second call does not call resolve again', async () => {
    const bars = [fakeBar(T0), fakeBar(T1)]
    const provider = makeFakeProvider(bars)

    // First call writes the REF row.
    await getOHLCV(SYM, INTERVAL, T0, T1, provider)
    expect(provider.resolveCalls).toBe(1)

    // Second call: ref is cached, resolve should NOT be called.
    await getOHLCV(SYM, INTERVAL, T0, T1, provider)
    expect(provider.resolveCalls).toBe(1)

    // Also confirm getCachedRef returns the stored info.
    const ref = await getCachedRef(SYM)
    expect(ref).toMatchObject({ mint: FAKE_REF.mint, pool: FAKE_REF.pool, chain: 'solana', source: 'fake' })
  })
})

// ── Test 3: TTL rule ──────────────────────────────────────────────────────────

describe('TTL rule', () => {
  const INTERVAL = '1h'
  const nowSec = Math.floor(Date.now() / 1000)

  // Old bar: more than 1h before now — aligned to interval boundary.
  const oldTs = alignDown(nowSec - 7200, INTERVAL) // 2h ago, aligned

  // Recent bar: the current interval bucket — always within the last hour,
  // aligned to the boundary. (Aligning `nowSec - 300` would round into the
  // previous hour during the first ~5 min of any hour and drop the TTL.)
  const recentTs = alignDown(nowSec, INTERVAL)

  const SYM = 'TTLTEST'

  test('historical bucket has no ttl attr; recent bucket has a ttl number', async () => {
    const bars = [fakeBar(oldTs), fakeBar(recentTs)]
    const provider = makeFakeProvider(bars)

    await getOHLCV(SYM, INTERVAL, oldTs, recentTs, provider)

    // Fetch the old row directly and check ttl is absent.
    const oldKey = ohlcvKey(SYM, INTERVAL, oldTs)
    const oldRes = await ddb.send(new GetCommand({ TableName: TableNames.tokens, Key: oldKey }))
    expect(oldRes.Item).toBeDefined()
    expect(oldRes.Item!['ttl']).toBeUndefined()

    // Fetch the recent row directly and check ttl is a number.
    const recentKey = ohlcvKey(SYM, INTERVAL, recentTs)
    const recentRes = await ddb.send(new GetCommand({ TableName: TableNames.tokens, Key: recentKey }))
    expect(recentRes.Item).toBeDefined()
    expect(typeof recentRes.Item!['ttl']).toBe('number')
    // TTL should be roughly nowSec+300.
    const ttl = recentRes.Item!['ttl'] as number
    expect(ttl).toBeGreaterThan(nowSec)
    expect(ttl).toBeLessThanOrEqual(nowSec + 300 + 5) // small clock drift tolerance
  })
})

// ── Test 4: graceful degradation ──────────────────────────────────────────────

describe('graceful degradation', () => {
  const INTERVAL = '1h'
  const T0 = 0
  const T1 = 3600
  const SYM = 'DEGRADETEST'

  test('if fetchOHLCV throws, getOHLCV returns cached bars without throwing', async () => {
    // Pre-seed one bar so there is something cached.
    const nowSec = Math.floor(Date.now() / 1000)
    // Write one bar at T0 directly.
    const { writeOhlcvBuckets } = await import('@monorepo-template/core/db/ohlcv')
    await writeOhlcvBuckets(SYM, INTERVAL, [fakeBar(T0)], nowSec)

    // Also seed the REF row so resolveRef doesn't need a provider call.
    const { ddb: ddbClient, TableNames: TN } = await import('@monorepo-template/core/db/client')
    const { tokenRefKey: trk } = await import('@monorepo-template/core/db/keys')
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb')
    await ddbClient.send(new PutCommand({ TableName: TN.tokens, Item: { ...trk(SYM), ...FAKE_REF } }))

    // Provider that throws on fetchOHLCV.
    const throwingProvider: PriceProvider = {
      id: 'throwing',
      async resolve(): Promise<TokenRef | null> { return FAKE_REF },
      async fetchOHLCV(): Promise<OHLCVBar[]> { throw new Error('API down') },
    }

    // Should NOT throw; should return the cached bar (T0 is within [T0, T1]).
    const result = await getOHLCV(SYM, INTERVAL, T0, T1, throwingProvider)
    expect(result.some((b) => b.ts === T0)).toBe(true)
  })

  test('if fetchOHLCV throws and nothing is cached, getOHLCV returns empty array', async () => {
    const SYM2 = 'DEGRADEEMPTY'

    const throwingProvider: PriceProvider = {
      id: 'throwing',
      async resolve(): Promise<TokenRef | null> { return FAKE_REF },
      async fetchOHLCV(): Promise<OHLCVBar[]> { throw new Error('API down') },
    }

    const result = await getOHLCV(SYM2, INTERVAL, T0, T1, throwingProvider)
    expect(result).toEqual([])
  })
})
