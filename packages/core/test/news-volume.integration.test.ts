/**
 * Integration tests for incrementNewsVolume / readNewsVolume using the real
 * dynalite harness against the Aggregates table.
 *
 * Covers:
 *   (a) Basic increment — PRESS twice + NEWS once survive write→read, with
 *       PRESS accumulating to 2.
 *   (b) Kind filter — readNewsVolume(sym, 'PRESS') returns only PRESS rows.
 *   (c) Unknown symbol — readNewsVolume returns [] for an unseen symbol.
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import { incrementNewsVolume, readNewsVolume } from '@monorepo-template/core/db/aggregates'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

const ENDPOINT = 'http://127.0.0.1:8000'

const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearNewsVolume() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.aggregates,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    const pk = item.pk.S
    if (!pk || !pk.startsWith('AGG#NEWS_VOLUME#')) continue
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.aggregates,
        Key: { pk, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await clearNewsVolume()
})

describe('incrementNewsVolume / readNewsVolume (dynalite integration)', () => {
  test('(a) PRESS x2 and NEWS x1 are returned with correct accumulated counts', async () => {
    const symbol = 'BTC'
    await incrementNewsVolume(symbol, 'PRESS', '2026-06-01')
    await incrementNewsVolume(symbol, 'PRESS', '2026-06-01')
    await incrementNewsVolume(symbol, 'NEWS', '2026-06-01')

    const rows = await readNewsVolume(symbol)
    expect(rows).toHaveLength(2)

    const press = rows.find((r) => r.kind === 'PRESS')
    const news = rows.find((r) => r.kind === 'NEWS')
    expect(press).toEqual({ kind: 'PRESS', day: '2026-06-01', count: 2 })
    expect(news).toEqual({ kind: 'NEWS', day: '2026-06-01', count: 1 })
  })

  test('(b) readNewsVolume(sym, "PRESS") filters by kind', async () => {
    const symbol = 'ETH'
    await incrementNewsVolume(symbol, 'PRESS', '2026-06-02')
    await incrementNewsVolume(symbol, 'NEWS', '2026-06-02')

    const pressOnly = await readNewsVolume(symbol, 'PRESS')
    expect(pressOnly).toHaveLength(1)
    expect(pressOnly[0]).toEqual({ kind: 'PRESS', day: '2026-06-02', count: 1 })
  })

  test('(b2) results are sorted by day descending', async () => {
    const symbol = 'SOL'
    await incrementNewsVolume(symbol, 'PRESS', '2026-06-01')
    await incrementNewsVolume(symbol, 'PRESS', '2026-06-03')
    await incrementNewsVolume(symbol, 'PRESS', '2026-06-02')

    const rows = await readNewsVolume(symbol, 'PRESS')
    expect(rows.map((r) => r.day)).toEqual(['2026-06-03', '2026-06-02', '2026-06-01'])
  })

  test('(c) unknown symbol returns empty array', async () => {
    const rows = await readNewsVolume('UNKNOWN_SYMBOL_XYZ')
    expect(rows).toEqual([])
  })
})
