/**
 * Pure unit tests for the M13 feed + token-profile key builders.
 * No DynamoDB access — these tests run in the unit suite (vitest.config.ts).
 */

import { describe, expect, test } from 'vitest'
import {
  tokenProfileKey,
  feedItemKey,
  feedTokenGsi,
  feedGuidGsi,
  feedSourceKey,
  watchlistBySymbolGsi,
} from './keys'

const ISO_TS = '2026-05-30T12:00:00.000Z'
const ENTRY_ID = 'abc123'

describe('tokenProfileKey', () => {
  test('produces pk=TOKEN#<SYM> and sk=PROFILE', () => {
    expect(tokenProfileKey('BTC')).toEqual({
      pk: 'TOKEN#BTC',
      sk: 'PROFILE',
    })
  })

  test('uppercases symbol', () => {
    const key = tokenProfileKey('btc')
    expect(key.pk).toBe('TOKEN#BTC')
    expect(key.sk).toBe('PROFILE')
  })
})

describe('feedItemKey', () => {
  test('produces correct pk and sk for PRESS kind', () => {
    expect(feedItemKey('BTC', 'PRESS', ISO_TS, ENTRY_ID)).toEqual({
      pk: 'FEED#BTC#PRESS',
      sk: `${ISO_TS}#${ENTRY_ID}`,
    })
  })

  test('uppercases symbol', () => {
    const key = feedItemKey('btc', 'PRESS', ISO_TS, ENTRY_ID)
    expect(key.pk).toBe('FEED#BTC#PRESS')
  })

  test('sk format is <ISO-ts>#<entryId>', () => {
    const key = feedItemKey('ETH', 'NEWS', ISO_TS, 'xyz')
    expect(key.sk).toBe(`${ISO_TS}#xyz`)
  })
})

describe('feedTokenGsi', () => {
  test('produces gsi1pk=FEED#<SYM> and gsi1sk=<KIND>#<ISO-ts>#<entryId>', () => {
    expect(feedTokenGsi('BTC', 'PRESS', ISO_TS, ENTRY_ID)).toEqual({
      gsi1pk: 'FEED#BTC',
      gsi1sk: `PRESS#${ISO_TS}#${ENTRY_ID}`,
    })
  })

  test('uppercases symbol', () => {
    const gsi = feedTokenGsi('sol', 'NEWS', ISO_TS, 'e1')
    expect(gsi.gsi1pk).toBe('FEED#SOL')
  })

  test('gsi1sk format is <KIND>#<ISO-ts>#<entryId>', () => {
    const gsi = feedTokenGsi('ETH', 'NEWS', ISO_TS, 'e2')
    expect(gsi.gsi1sk).toBe(`NEWS#${ISO_TS}#e2`)
  })
})

describe('feedGuidGsi', () => {
  test('produces gsi2pk=FEEDGUID#<feedUrlHash> and gsi2sk=<guidHash>', () => {
    expect(feedGuidGsi('hash1', 'ghash1')).toEqual({
      gsi2pk: 'FEEDGUID#hash1',
      gsi2sk: 'ghash1',
    })
  })
})

describe('feedSourceKey', () => {
  test('produces pk=FEEDSRC#<SYM>#<KIND> and sk=SRC#<feedUrlHash>', () => {
    expect(feedSourceKey('BTC', 'PRESS', 'urlhash1')).toEqual({
      pk: 'FEEDSRC#BTC#PRESS',
      sk: 'SRC#urlhash1',
    })
  })

  test('uppercases symbol', () => {
    const key = feedSourceKey('eth', 'NEWS', 'hash2')
    expect(key.pk).toBe('FEEDSRC#ETH#NEWS')
  })

  test('sk format is SRC#<feedUrlHash>', () => {
    const key = feedSourceKey('SOL', 'PRESS', 'myhash')
    expect(key.sk).toBe('SRC#myhash')
  })
})

describe('watchlistBySymbolGsi', () => {
  test('produces gsi1pk=WATCHSYM#<SYM> and gsi1sk=USER#<userId>', () => {
    expect(watchlistBySymbolGsi('BTC', 'user_abc')).toEqual({
      gsi1pk: 'WATCHSYM#BTC',
      gsi1sk: 'USER#user_abc',
    })
  })

  test('uppercases symbol', () => {
    const gsi = watchlistBySymbolGsi('eth', 'user_xyz')
    expect(gsi.gsi1pk).toBe('WATCHSYM#ETH')
    expect(gsi.gsi1sk).toBe('USER#user_xyz')
  })
})

describe('key-space disjoint invariants (ByokHolders GSI)', () => {
  test('WATCHSYM# prefix does not start with BYOK#', () => {
    const { gsi1pk } = watchlistBySymbolGsi('BTC', 'u1')
    expect(gsi1pk.startsWith('BYOK#')).toBe(false)
  })

  test('WATCHSYM# prefix does not start with ALERTTOKEN#', () => {
    const { gsi1pk } = watchlistBySymbolGsi('BTC', 'u1')
    expect(gsi1pk.startsWith('ALERTTOKEN#')).toBe(false)
  })

  test('WATCHSYM# prefix does not equal MONITORS', () => {
    const { gsi1pk } = watchlistBySymbolGsi('BTC', 'u1')
    expect(gsi1pk).not.toBe('MONITORS')
  })
})
