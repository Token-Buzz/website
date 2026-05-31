/**
 * Integration test for setRef — exercises the real `packages/core/src/db/ohlcv.ts`
 * `setRef` function against a local dynalite DynamoDB.
 *
 * Verifies:
 *   (a) After setRef, getCachedRef returns the new ref.
 *   (b) After setRef, all previously cached OHLCV rows for that symbol are gone
 *       (i.e. queryCachedOhlcv returns empty).
 */

import { describe, test, expect } from 'vitest'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import { tokenRefKey } from '@monorepo-template/core/db/keys'
import {
  getCachedRef,
  setRef,
  writeOhlcvBuckets,
  queryCachedOhlcv,
} from '@monorepo-template/core/db/ohlcv'
import type { TokenRef, OHLCVBar } from '@monorepo-template/core/providers/price'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeBar(ts: number): OHLCVBar {
  return { ts, open: 10, high: 12, low: 9, close: 11, volume: 500 }
}

const INITIAL_REF: TokenRef = {
  symbol: 'SRTEST',
  mint: 'InitialMint11111111111111111111111111',
  pool: 'InitialPool11111111111111111111111111',
  chain: 'solana',
  source: 'geckoterminal',
}

const NEW_REF: TokenRef = {
  symbol: 'SRTEST',
  mint: 'NewMint222222222222222222222222222222',
  pool: 'NewPool22222222222222222222222222222',
  chain: 'solana',
  source: 'geckoterminal',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('setRef', () => {
  const SYMBOL = 'SRTEST'
  const INTERVAL = '1h'
  // Use well-in-the-past timestamps so TTL logic doesn't interfere.
  const T0 = 0
  const T1 = 3600
  const T2 = 7200
  const nowSec = Math.floor(Date.now() / 1000)

  test('updates the cached ref and invalidates all OHLCV rows', async () => {
    // Seed the initial ref directly via PutCommand (mirrors what resolveRef does).
    await ddb.send(
      new PutCommand({
        TableName: TableNames.tokens,
        Item: { ...tokenRefKey(SYMBOL), ...INITIAL_REF },
      }),
    )

    // Seed some OHLCV rows for this symbol.
    await writeOhlcvBuckets(SYMBOL, INTERVAL, [fakeBar(T0), fakeBar(T1), fakeBar(T2)], nowSec)

    // Confirm OHLCV rows are present before the update.
    const before = await queryCachedOhlcv(SYMBOL, INTERVAL, T0, T2)
    expect(before).toHaveLength(3)

    // Confirm the initial ref is cached.
    const refBefore = await getCachedRef(SYMBOL)
    expect(refBefore).toMatchObject({ pool: INITIAL_REF.pool, mint: INITIAL_REF.mint })

    // Call setRef with the new ref.
    await setRef(SYMBOL, NEW_REF)

    // (a) getCachedRef should now return the new ref.
    const refAfter = await getCachedRef(SYMBOL)
    expect(refAfter).not.toBeNull()
    expect(refAfter!.pool).toBe(NEW_REF.pool)
    expect(refAfter!.mint).toBe(NEW_REF.mint)
    expect(refAfter!.symbol).toBe('SRTEST')

    // (b) All OHLCV rows for this symbol should be gone.
    const after = await queryCachedOhlcv(SYMBOL, INTERVAL, T0, T2)
    expect(after).toHaveLength(0)
  })

  test('works when there are no cached OHLCV rows (no-op delete)', async () => {
    const SYMBOL2 = 'SRTESTEMPTY'
    const emptyRef: TokenRef = {
      symbol: SYMBOL2,
      mint: 'EmptyMint333333333333333333333333333',
      pool: 'EmptyPool33333333333333333333333333',
      chain: 'solana',
      source: 'geckoterminal',
    }

    // No OHLCV rows seeded — setRef should not throw.
    await expect(setRef(SYMBOL2, emptyRef)).resolves.toBeUndefined()

    // Ref should be written.
    const ref = await getCachedRef(SYMBOL2)
    expect(ref).not.toBeNull()
    expect(ref!.pool).toBe(emptyRef.pool)
  })

  test('invalidates OHLCV rows across multiple intervals', async () => {
    const SYMBOL3 = 'SRTESTMULTI'
    const multiRef: TokenRef = {
      symbol: SYMBOL3,
      mint: 'MultiMint444444444444444444444444444',
      pool: 'MultiPool44444444444444444444444444',
      chain: 'solana',
      source: 'geckoterminal',
    }
    const newMultiRef: TokenRef = { ...multiRef, pool: 'NewMultiPool5555555555555555555555' }

    // Seed OHLCV rows for two different intervals.
    await writeOhlcvBuckets(SYMBOL3, '1h', [fakeBar(T0), fakeBar(T1)], nowSec)
    await writeOhlcvBuckets(SYMBOL3, '4h', [fakeBar(0), fakeBar(14400)], nowSec)

    // Confirm both intervals have rows.
    expect(await queryCachedOhlcv(SYMBOL3, '1h', T0, T1)).toHaveLength(2)
    expect(await queryCachedOhlcv(SYMBOL3, '4h', 0, 14400)).toHaveLength(2)

    await setRef(SYMBOL3, newMultiRef)

    // Both intervals should be cleared.
    expect(await queryCachedOhlcv(SYMBOL3, '1h', T0, T1)).toHaveLength(0)
    expect(await queryCachedOhlcv(SYMBOL3, '4h', 0, 14400)).toHaveLength(0)
  })
})
