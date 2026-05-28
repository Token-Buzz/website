/**
 * Integration tests for incrementSourceCount / readSourceCounts using the
 * real dynalite harness against the Aggregates table.
 *
 * Covers:
 *   (a) Basic increment — twitter +5 and reddit +3 survive write→read.
 *   (b) Accumulation — a second increment adds to the first.
 *   (c) Unknown query — readSourceCounts returns {} for an unseen query.
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import { incrementSourceCount, readSourceCounts } from '@monorepo-template/core/db/source-counts'
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

describe('incrementSourceCount / readSourceCounts (dynalite integration)', () => {
  test('(a) twitter +5 and reddit +3 are returned correctly', async () => {
    const query = 'BTC'
    await incrementSourceCount(query, 'twitter', 5)
    await incrementSourceCount(query, 'reddit', 3)

    const counts = await readSourceCounts(query)
    expect(counts).toEqual({ twitter: 5, reddit: 3 })
  })

  test('(b) a second increment accumulates on the first', async () => {
    const query = 'ETH'
    await incrementSourceCount(query, 'twitter', 5)
    await incrementSourceCount(query, 'twitter', 2)

    const counts = await readSourceCounts(query)
    expect(counts.twitter).toBe(7)
  })

  test('(c) unknown query returns empty object', async () => {
    const counts = await readSourceCounts('UNKNOWN_QUERY_XYZ')
    expect(counts).toEqual({})
  })
})
