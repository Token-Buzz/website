/**
 * Integration tests for writeSocialEvent / readSocialEvents using the real
 * dynalite harness against the Aggregates table.
 *
 * Covers:
 *   (a) Basic round-trip — events survive write→read with all fields intact.
 *   (b) Type filtering — only requested types are returned.
 *   (c) Time-range filtering — events outside [from, to] are excluded.
 *   (d) Ascending sort by ts across types.
 *   (e) tweets sample survives the round-trip.
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import { writeSocialEvent, readSocialEvents } from '@monorepo-template/core/db/social-events'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import type { SocialEvent } from '@monorepo-template/core/social-events'

const ENDPOINT = 'http://127.0.0.1:8000'

const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearAggregates() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.aggregates,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.aggregates,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

// Fixed base timestamp: 2024-01-15T12:00:00Z in unix seconds.
const BASE_TS = 1705320000

function makeVolumeSpikeEvent(overrides: Partial<SocialEvent> & { ts: number }): SocialEvent {
  return {
    type: 'SOCIAL_SPIKE',
    symbol: 'BTC',
    ts: overrides.ts,
    marker: 'up',
    title: `Mention spike · 50/min`,
    magnitude: 3.5,
    direction: 'positive',
    ...overrides,
  }
}

function makeSentimentSpikeEvent(overrides: Partial<SocialEvent> & { ts: number }): SocialEvent {
  return {
    type: 'SENTIMENT_SPIKE',
    symbol: 'BTC',
    ts: overrides.ts,
    marker: 'up',
    title: 'Bullish sentiment swing',
    magnitude: 0.6,
    direction: 'positive',
    ...overrides,
  }
}

function makeKolPostEvent(overrides: Partial<SocialEvent> & { ts: number }): SocialEvent {
  return {
    type: 'KOL_POST',
    symbol: 'BTC',
    ts: overrides.ts,
    marker: 'dot',
    title: '@cobie',
    tweets: [{ tweetId: 'tw-001', handle: 'cobie', text: 'BTC is pumping!' }],
    ...overrides,
  }
}

beforeEach(async () => {
  await clearAggregates()
})

describe('writeSocialEvent / readSocialEvents (dynalite integration)', () => {
  test('(a) basic round-trip — all fields survive write→read', async () => {
    const ev = makeKolPostEvent({
      ts: BASE_TS,
      tweets: [{ tweetId: 'tw-rt-001', handle: 'cobie', text: 'Round-trip test!' }],
    })
    await writeSocialEvent(ev, 'id-rt-001')

    const results = await readSocialEvents({
      symbol: 'BTC',
      types: ['KOL_POST'],
      from: BASE_TS,
      to: BASE_TS + 60,
    })

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r.type).toBe('KOL_POST')
    expect(r.symbol).toBe('BTC')
    expect(r.ts).toBe(BASE_TS)
    expect(r.marker).toBe('dot')
    expect(r.title).toBe('@cobie')
    expect(r.tweets).toHaveLength(1)
    expect(r.tweets![0].tweetId).toBe('tw-rt-001')
    expect(r.tweets![0].handle).toBe('cobie')
    expect(r.tweets![0].text).toBe('Round-trip test!')
  })

  test('(b) type filtering — only requested types are returned', async () => {
    // Write one event of each type at distinct timestamps.
    await writeSocialEvent(makeVolumeSpikeEvent({ ts: BASE_TS + 100 }), 'spike-1')
    await writeSocialEvent(makeSentimentSpikeEvent({ ts: BASE_TS + 200 }), 'sent-1')
    await writeSocialEvent(makeKolPostEvent({ ts: BASE_TS + 300 }), 'kol-1')

    // Request only SOCIAL_SPIKE and SENTIMENT_SPIKE — KOL_POST must be absent.
    const results = await readSocialEvents({
      symbol: 'BTC',
      types: ['SOCIAL_SPIKE', 'SENTIMENT_SPIKE'],
      from: BASE_TS,
      to: BASE_TS + 400,
    })

    expect(results).toHaveLength(2)
    const types = results.map((r) => r.type)
    expect(types).toContain('SOCIAL_SPIKE')
    expect(types).toContain('SENTIMENT_SPIKE')
    expect(types).not.toContain('KOL_POST')
  })

  test('(c) time-range filtering — events outside [from, to] are excluded', async () => {
    const INSIDE_TS = BASE_TS + 500
    const BEFORE_TS = BASE_TS - 200  // before range
    const AFTER_TS  = BASE_TS + 900  // after range

    await writeSocialEvent(makeVolumeSpikeEvent({ ts: INSIDE_TS }), 'inside')
    await writeSocialEvent(makeVolumeSpikeEvent({ ts: BEFORE_TS }), 'before')
    await writeSocialEvent(makeVolumeSpikeEvent({ ts: AFTER_TS }),  'after')

    const results = await readSocialEvents({
      symbol: 'BTC',
      types: ['SOCIAL_SPIKE'],
      from: BASE_TS,
      to: BASE_TS + 800,
    })

    expect(results).toHaveLength(1)
    expect(results[0].ts).toBe(INSIDE_TS)
  })

  test('(d) results are sorted ascending by ts across types', async () => {
    // Write events at interleaved timestamps of different types.
    await writeSocialEvent(makeKolPostEvent({ ts: BASE_TS + 600 }), 'kol-sort-1')
    await writeSocialEvent(makeVolumeSpikeEvent({ ts: BASE_TS + 200 }), 'spike-sort-1')
    await writeSocialEvent(makeSentimentSpikeEvent({ ts: BASE_TS + 400 }), 'sent-sort-1')
    await writeSocialEvent(makeVolumeSpikeEvent({ ts: BASE_TS + 100 }), 'spike-sort-2')

    const results = await readSocialEvents({
      symbol: 'BTC',
      from: BASE_TS,
      to: BASE_TS + 700,
    })

    expect(results.length).toBeGreaterThanOrEqual(4)
    // Verify ascending order.
    for (let i = 1; i < results.length; i++) {
      expect(results[i].ts).toBeGreaterThanOrEqual(results[i - 1].ts)
    }
  })

  test('(e) tweets sample survives the round-trip', async () => {
    const tweet = {
      tweetId: 'tw-sample-999',
      handle: 'gainzy222',
      text: 'Accumulating $BTC on this dip. Not financial advice.',
    }
    const ev = makeKolPostEvent({ ts: BASE_TS + 750, tweets: [tweet] })
    await writeSocialEvent(ev, 'kol-tweet-rt')

    const results = await readSocialEvents({
      symbol: 'BTC',
      types: ['KOL_POST'],
      from: BASE_TS + 700,
      to: BASE_TS + 800,
    })

    expect(results).toHaveLength(1)
    expect(results[0].tweets).toBeDefined()
    expect(results[0].tweets).toHaveLength(1)
    expect(results[0].tweets![0]).toEqual(tweet)
  })

  test('empty result when no events exist in range', async () => {
    const results = await readSocialEvents({
      symbol: 'BTC',
      from: BASE_TS,
      to: BASE_TS + 100,
    })
    expect(results).toEqual([])
  })

  test('symbol is case-insensitive — lowercase input matches uppercase stored symbol', async () => {
    await writeSocialEvent(makeVolumeSpikeEvent({ ts: BASE_TS + 50 }), 'case-test')

    const results = await readSocialEvents({
      symbol: 'btc', // lowercase query
      types: ['SOCIAL_SPIKE'],
      from: BASE_TS,
      to: BASE_TS + 100,
    })

    expect(results).toHaveLength(1)
    expect(results[0].symbol).toBe('BTC')
  })
})
