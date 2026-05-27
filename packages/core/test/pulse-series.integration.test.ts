/**
 * Integration tests for readPulseSeries using the real dynalite harness
 * against the Aggregates table.
 *
 * Covers:
 *   (a) Basic round-trip — written PULSE rows surface with correct bucket/count.
 *   (b) Ascending order — buckets returned in chronological (ascending) order.
 *   (c) Range exclusion — buckets outside [from, to] are excluded.
 *   (d) Multiple increments — count accumulates across multiple incrementPulse calls.
 *   (e) Empty range — returns [] when no buckets exist.
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import { incrementPulse, readPulseSeries } from '@monorepo-template/core/db/aggregates'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

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

beforeEach(async () => {
  await clearAggregates()
})

// Fixed minute buckets in slice(0,16) form — same format the aggregator writes.
const B40 = '2026-05-27T15:40'
const B41 = '2026-05-27T15:41'
const B42 = '2026-05-27T15:42'
const B43 = '2026-05-27T15:43'
const B44 = '2026-05-27T15:44'
// Out-of-range buckets
const BEFORE = '2026-05-27T15:39'
const AFTER  = '2026-05-27T15:45'

describe('readPulseSeries (dynalite integration)', () => {
  test('(a) basic round-trip — written PULSE rows surface with correct bucket/count', async () => {
    await incrementPulse('$BTC', B41)
    await incrementPulse('$BTC', B42)
    await incrementPulse('$BTC', B42)

    const result = await readPulseSeries('$BTC', B41, B42)

    expect(result).toHaveLength(2)
    const b41 = result.find((r) => r.bucket === B41)
    const b42 = result.find((r) => r.bucket === B42)
    expect(b41).toBeDefined()
    expect(b41!.count).toBe(1)
    expect(b42).toBeDefined()
    expect(b42!.count).toBe(2)
  })

  test('(b) ascending order — buckets returned in chronological order', async () => {
    // Write in reverse order to ensure the function sorts, not just returns insertion order.
    await incrementPulse('$SOL', B44)
    await incrementPulse('$SOL', B40)
    await incrementPulse('$SOL', B42)

    const result = await readPulseSeries('$SOL', B40, B44)

    expect(result).toHaveLength(3)
    expect(result[0].bucket).toBe(B40)
    expect(result[1].bucket).toBe(B42)
    expect(result[2].bucket).toBe(B44)
  })

  test('(c) range exclusion — buckets outside [from, to] are excluded', async () => {
    await incrementPulse('$PEPE', BEFORE) // outside — before range
    await incrementPulse('$PEPE', B41)    // inside
    await incrementPulse('$PEPE', B42)    // inside
    await incrementPulse('$PEPE', B43)    // inside
    await incrementPulse('$PEPE', AFTER)  // outside — after range

    const result = await readPulseSeries('$PEPE', B41, B43)

    expect(result).toHaveLength(3)
    const buckets = result.map((r) => r.bucket)
    expect(buckets).toContain(B41)
    expect(buckets).toContain(B42)
    expect(buckets).toContain(B43)
    expect(buckets).not.toContain(BEFORE)
    expect(buckets).not.toContain(AFTER)
  })

  test('(d) multiple increments accumulate correctly', async () => {
    // 5 tweet events in the same minute bucket → count should be 5.
    for (let i = 0; i < 5; i++) {
      await incrementPulse('$MOG', B43)
    }

    const result = await readPulseSeries('$MOG', B43, B43)

    expect(result).toHaveLength(1)
    expect(result[0].bucket).toBe(B43)
    expect(result[0].count).toBe(5)
  })

  test('(e) empty range — returns [] when no buckets exist in range', async () => {
    // Write a bucket outside the queried range.
    await incrementPulse('$WIF', BEFORE)

    const result = await readPulseSeries('$WIF', B40, B44)

    expect(result).toEqual([])
  })

  test('(f) symbol isolation — results do not bleed across symbols', async () => {
    await incrementPulse('$AAA', B41)
    await incrementPulse('$AAA', B41)
    await incrementPulse('$BBB', B41)

    const resultA = await readPulseSeries('$AAA', B41, B41)
    const resultB = await readPulseSeries('$BBB', B41, B41)

    expect(resultA).toHaveLength(1)
    expect(resultA[0].count).toBe(2)
    expect(resultB).toHaveLength(1)
    expect(resultB[0].count).toBe(1)
  })
})
