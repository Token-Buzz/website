/**
 * Integration test for listSavedQueries — exercises the new access pattern
 * against a local dynalite DynamoDB.
 *
 * Verifies:
 *   - write→read round-trip: items created via createSavedQuery are visible
 *     to listSavedQueries
 *   - results are sorted newest-first by submittedAt
 *   - the snapshot field is NOT present (projected out)
 *   - user isolation: listSavedQueries only returns items for the requested user
 */

import { beforeEach, describe, expect, test } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import {
  createSavedQuery,
  listSavedQueries,
} from '@monorepo-template/core/db/saved-queries'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ENDPOINT = 'http://127.0.0.1:8000'
const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearUserData() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.userData,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.userData,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await clearUserData()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('listSavedQueries (dynalite integration)', () => {
  const USER_ID = 'sq_list_test_user'

  test('returns empty array when no saved queries exist', async () => {
    const results = await listSavedQueries('sq_list_empty_user')
    expect(results).toEqual([])
  })

  test('write-read round-trip: created items appear in list', async () => {
    await createSavedQuery({
      userId: USER_ID,
      query: 'bitcoin',
      snapshot: { mentions: [{ mention: 'a', count: 1 }] },
    })

    const results = await listSavedQueries(USER_ID)
    expect(results).toHaveLength(1)
    expect(results[0].query).toBe('bitcoin')
    expect(results[0].userId).toBe(USER_ID)
  })

  test('snapshot field is absent from list results (projected out)', async () => {
    await createSavedQuery({
      userId: USER_ID,
      query: 'ethereum',
      snapshot: { bigData: 'should not be returned', count: 9999 },
    })

    const results = await listSavedQueries(USER_ID)
    expect(results).toHaveLength(1)
    // snapshot must NOT be present
    expect('snapshot' in results[0]).toBe(false)
  })

  test('results are sorted newest-first by submittedAt', async () => {
    // Create 3 items; small delays to ensure distinct submittedAt values
    const first = await createSavedQuery({ userId: USER_ID, query: 'query-first', snapshot: null })
    await new Promise((r) => setTimeout(r, 10))
    const second = await createSavedQuery({ userId: USER_ID, query: 'query-second', snapshot: null })
    await new Promise((r) => setTimeout(r, 10))
    const third = await createSavedQuery({ userId: USER_ID, query: 'query-third', snapshot: null })

    const results = await listSavedQueries(USER_ID)
    expect(results).toHaveLength(3)
    // Newest first: third, second, first
    expect(results[0].submittedAt).toBe(third.submittedAt)
    expect(results[1].submittedAt).toBe(second.submittedAt)
    expect(results[2].submittedAt).toBe(first.submittedAt)
  })

  test('user isolation: only returns items for the requested user', async () => {
    const OTHER_USER = 'sq_list_other_user'

    await createSavedQuery({ userId: USER_ID, query: 'my-query', snapshot: null })
    await createSavedQuery({ userId: OTHER_USER, query: 'other-query', snapshot: null })

    const results = await listSavedQueries(USER_ID)
    expect(results).toHaveLength(1)
    expect(results[0].userId).toBe(USER_ID)
    expect(results[0].query).toBe('my-query')

    const otherResults = await listSavedQueries(OTHER_USER)
    expect(otherResults).toHaveLength(1)
    expect(otherResults[0].userId).toBe(OTHER_USER)
  })

  test('all projected scalar fields are present', async () => {
    await createSavedQuery({ userId: USER_ID, query: 'fields-check', snapshot: null })

    const results = await listSavedQueries(USER_ID)
    expect(results).toHaveLength(1)
    const item = results[0]

    expect(typeof item.userId).toBe('string')
    expect(typeof item.submittedAt).toBe('string')
    expect(typeof item.queryHash).toBe('string')
    expect(typeof item.query).toBe('string')
    expect(typeof item.createdAt).toBe('string')
  })

  test('ttl field is projected when set', async () => {
    const ttl = 1_900_000_000
    await createSavedQuery({ userId: USER_ID, query: 'with-ttl', snapshot: null, ttl })

    const results = await listSavedQueries(USER_ID)
    expect(results).toHaveLength(1)
    expect(results[0].ttl).toBe(ttl)
  })
})
