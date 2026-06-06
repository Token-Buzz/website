/**
 * Integration tests for incrementNewsSource / readTopNewsSources using the real
 * dynalite harness against the Aggregates table.
 *
 * Covers:
 *   (a) Two articles from "CoinDesk" and one from "Decrypt" in the SAME hour
 *       bucket → readTopNewsSources returns [{value:'CoinDesk',count:2},
 *       {value:'Decrypt',count:1}] (CoinDesk first).
 *   (b) Counts accumulate across two different hour buckets for the same source.
 *   (c) readAggregateTopK({type:'NEWS_SOURCE'}) returns the same merged data.
 *   (d) Unknown symbol → readTopNewsSources returns [].
 *   (e) k limit is respected (write 3 sources, request k=2 → length 2).
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import {
  incrementNewsSource,
  readTopNewsSources,
  readAggregateTopK,
} from '@monorepo-template/core/db/aggregates'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import { hourBucket } from '@monorepo-template/core/db/keys'

const ENDPOINT = 'http://127.0.0.1:8000'

const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearNewsSource() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.aggregates,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    const pk = item.pk.S
    if (!pk || !pk.startsWith('AGG#NEWS_SOURCE#')) continue
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.aggregates,
        Key: { pk, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await clearNewsSource()
})

describe('incrementNewsSource / readTopNewsSources (dynalite integration)', () => {
  test('(a) CoinDesk x2 and Decrypt x1 in same hour bucket are returned with correct counts', async () => {
    const symbol = 'BTC'
    const bucket = hourBucket(new Date())

    await incrementNewsSource(symbol, 'CoinDesk', bucket)
    await incrementNewsSource(symbol, 'CoinDesk', bucket)
    await incrementNewsSource(symbol, 'Decrypt', bucket)

    const rows = await readTopNewsSources(symbol)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ value: 'CoinDesk', count: 2 })
    expect(rows[1]).toEqual({ value: 'Decrypt', count: 1 })
  })

  test('(b) counts accumulate across two different hour buckets for the same source', async () => {
    const symbol = 'ETH'
    const bucketH1 = hourBucket(new Date())
    const bucketH2 = hourBucket(new Date(Date.now() - 3600 * 1000))

    await incrementNewsSource(symbol, 'CoinDesk', bucketH1)
    await incrementNewsSource(symbol, 'CoinDesk', bucketH2)

    const rows = await readTopNewsSources(symbol)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ value: 'CoinDesk', count: 2 })
  })

  test('(c) readAggregateTopK({type:"NEWS_SOURCE"}) returns the same merged data', async () => {
    const symbol = 'SOL'
    const bucketH1 = hourBucket(new Date())
    const bucketH2 = hourBucket(new Date(Date.now() - 3600 * 1000))

    await incrementNewsSource(symbol, 'TheBlock', bucketH1)
    await incrementNewsSource(symbol, 'TheBlock', bucketH2)
    await incrementNewsSource(symbol, 'Decrypt', bucketH1)

    const from = hourBucket(new Date(Date.now() - 2 * 3600 * 1000))
    const to = hourBucket(new Date())

    const rows = await readAggregateTopK({
      type: 'NEWS_SOURCE',
      query: symbol.toUpperCase(),
      from,
      to,
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ value: 'TheBlock', count: 2 })
    expect(rows[1]).toEqual({ value: 'Decrypt', count: 1 })
  })

  test('(d) unknown symbol returns empty array', async () => {
    const rows = await readTopNewsSources('UNKNOWN_XYZ')
    expect(rows).toEqual([])
  })

  test('(e) k limit is respected — write 3 sources, request k=2 → length 2, top-2 by count', async () => {
    const symbol = 'ADA'
    const bucket = hourBucket(new Date())

    await incrementNewsSource(symbol, 'CoinDesk', bucket)
    await incrementNewsSource(symbol, 'CoinDesk', bucket)
    await incrementNewsSource(symbol, 'CoinDesk', bucket)
    await incrementNewsSource(symbol, 'Decrypt', bucket)
    await incrementNewsSource(symbol, 'Decrypt', bucket)
    await incrementNewsSource(symbol, 'TheBlock', bucket)

    const rows = await readTopNewsSources(symbol, { k: 2 })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ value: 'CoinDesk', count: 3 })
    expect(rows[1]).toEqual({ value: 'Decrypt', count: 2 })
  })
})
