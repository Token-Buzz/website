/**
 * Integration tests for `packages/core/src/db/poll-state.ts`.
 *
 * Exercises getLastPolledAt / markPolled / shouldPollNow against a real
 * dynalite DynamoDB.  No AWS credentials or KMS required.
 */

import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

import {
  getLastPolledAt,
  markPolled,
  shouldPollNow,
} from '@monorepo-template/core/db/poll-state'

// ── Helpers ───────────────────────────────────────────────────────────────────

const rawClient = new DynamoDBClient({
  endpoint: 'http://127.0.0.1:8000',
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearAggregates(): Promise<void> {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('poll-state (dynalite integration)', () => {
  beforeEach(async () => {
    await clearAggregates()
  })

  // ── getLastPolledAt ─────────────────────────────────────────────────────────

  test('getLastPolledAt returns null when never polled', async () => {
    const result = await getLastPolledAt('twitter', '$NEVER_POLLED')
    expect(result).toBeNull()
  })

  test('getLastPolledAt returns the stored epoch-ms after markPolled', async () => {
    const atMs = Date.now()
    await markPolled('twitter', '$BTC', atMs)

    const result = await getLastPolledAt('twitter', '$BTC')
    expect(result).toBe(atMs)
  })

  test('getLastPolledAt is scoped by source', async () => {
    const atMs = Date.now()
    await markPolled('twitter', '$ETH', atMs)

    // Different source — should return null.
    const result = await getLastPolledAt('farcaster', '$ETH')
    expect(result).toBeNull()
  })

  // ── markPolled ──────────────────────────────────────────────────────────────

  test('markPolled uses Date.now() when atMs is omitted', async () => {
    const before = Date.now()
    await markPolled('twitter', '$SOL')
    const after = Date.now()

    const stored = await getLastPolledAt('twitter', '$SOL')
    expect(stored).not.toBeNull()
    expect(stored!).toBeGreaterThanOrEqual(before)
    expect(stored!).toBeLessThanOrEqual(after)
  })

  test('markPolled overwrites an existing record', async () => {
    const first = Date.now() - 10_000
    await markPolled('twitter', '$DOGE', first)

    const second = Date.now()
    await markPolled('twitter', '$DOGE', second)

    const stored = await getLastPolledAt('twitter', '$DOGE')
    expect(stored).toBe(second)
  })

  test('markPolled writes a TTL field in epoch seconds ~7 days out', async () => {
    const atMs = Date.now()
    await markPolled('twitter', '$TTL_TEST', atMs)

    // Read the raw item to verify the ttl attribute.
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb')
    const { pollStateKey } = await import('@monorepo-template/core/db/keys')
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: TableNames.aggregates,
        Key: pollStateKey('twitter', '$TTL_TEST'),
      }),
    )
    expect(Item).toBeDefined()
    const ttl = Item!.ttl as number
    const expectedMin = Math.floor(atMs / 1000) + 6 * 24 * 60 * 60
    const expectedMax = Math.floor(atMs / 1000) + 8 * 24 * 60 * 60
    expect(ttl).toBeGreaterThanOrEqual(expectedMin)
    expect(ttl).toBeLessThanOrEqual(expectedMax)
  })

  // ── shouldPollNow ────────────────────────────────────────────────────────────

  test('shouldPollNow returns true when never polled', async () => {
    const result = await shouldPollNow('twitter', '$FRESH', 60_000)
    expect(result).toBe(true)
  })

  test('shouldPollNow returns false when polled recently (within interval)', async () => {
    const now = Date.now()
    await markPolled('twitter', '$RECENT', now)

    // Check 30 s after poll with a 60-s interval — should NOT poll yet.
    const result = await shouldPollNow('twitter', '$RECENT', 60_000, now + 30_000)
    expect(result).toBe(false)
  })

  test('shouldPollNow returns true when interval has elapsed', async () => {
    const now = Date.now()
    await markPolled('twitter', '$DUE', now)

    // Check exactly at the interval boundary.
    const result = await shouldPollNow('twitter', '$DUE', 60_000, now + 60_000)
    expect(result).toBe(true)
  })

  test('shouldPollNow returns true when well past the interval', async () => {
    const now = Date.now()
    await markPolled('twitter', '$OVERDUE', now)

    const result = await shouldPollNow('twitter', '$OVERDUE', 60_000, now + 120_000)
    expect(result).toBe(true)
  })

  test('shouldPollNow uses Date.now() when nowMs is omitted', async () => {
    // Mark polled in the future so it won't be due yet.
    const future = Date.now() + 5 * 60 * 1000
    await markPolled('twitter', '$FUTURE', future)

    // With a 60-second interval, not yet due (last polled in the future).
    const result = await shouldPollNow('twitter', '$FUTURE', 60_000)
    expect(result).toBe(false)
  })

  test('shouldPollNow is scoped by source', async () => {
    const now = Date.now()
    await markPolled('twitter', '$SCOPED', now)

    // Same query, different source: never polled → should poll.
    const result = await shouldPollNow('farcaster', '$SCOPED', 60_000, now + 30_000)
    expect(result).toBe(true)
  })
})
