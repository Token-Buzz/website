/**
 * Integration test for sweepExpiredSavedQueries — exercises the retention
 * sweep against a local dynalite DynamoDB.
 *
 * Verifies:
 *   - Expired rows (ttl <= now) are deleted and no longer visible
 *   - Unexpired rows (ttl > now) are kept
 *   - No-ttl (alpha-tier) rows are never deleted
 *   - Boundary: a row whose ttl exactly equals now IS deleted (filter is <= :now)
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
  getSavedQuery,
  listSavedQueries,
  sweepExpiredSavedQueries,
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

describe('sweepExpiredSavedQueries', () => {
  const now = Math.floor(Date.now() / 1000)

  test('deletes expired rows and removes them from reads', async () => {
    const userId = 'sweep_test_expired'
    const expiredTtl = now - 100

    const q1 = await createSavedQuery({ userId, query: 'expired-1', snapshot: null, ttl: expiredTtl })
    const q2 = await createSavedQuery({ userId, query: 'expired-2', snapshot: null, ttl: expiredTtl })

    const result = await sweepExpiredSavedQueries({ now })

    expect(result.deleted).toBe(2)

    // Both rows should no longer be retrievable
    expect(await getSavedQuery(userId, q1.submittedAt, q1.queryHash)).toBeNull()
    expect(await getSavedQuery(userId, q2.submittedAt, q2.queryHash)).toBeNull()

    // List should be empty too
    const listed = await listSavedQueries(userId)
    expect(listed).toHaveLength(0)
  })

  test('keeps unexpired rows (ttl in the future)', async () => {
    const userId = 'sweep_test_unexpired'
    const futureTtl = now + 100_000

    const q = await createSavedQuery({ userId, query: 'future-ttl', snapshot: null, ttl: futureTtl })

    const result = await sweepExpiredSavedQueries({ now })

    expect(result.deleted).toBe(0)

    // Row must still be there
    const fetched = await getSavedQuery(userId, q.submittedAt, q.queryHash)
    expect(fetched).not.toBeNull()
    expect(fetched!.query).toBe('future-ttl')
  })

  test('keeps no-ttl (alpha-tier) rows', async () => {
    const userId = 'sweep_test_no_ttl'

    const q = await createSavedQuery({ userId, query: 'alpha-no-ttl', snapshot: null })
    // Confirm no ttl was stored
    expect(q.ttl).toBeUndefined()

    const result = await sweepExpiredSavedQueries({ now })

    expect(result.deleted).toBe(0)

    // Row must still be there
    const fetched = await getSavedQuery(userId, q.submittedAt, q.queryHash)
    expect(fetched).not.toBeNull()
    expect(fetched!.query).toBe('alpha-no-ttl')
  })

  test('boundary: row with ttl === now is deleted', async () => {
    const userId = 'sweep_test_boundary'

    const q = await createSavedQuery({ userId, query: 'boundary-ttl', snapshot: null, ttl: now })

    const result = await sweepExpiredSavedQueries({ now })

    expect(result.deleted).toBe(1)
    expect(await getSavedQuery(userId, q.submittedAt, q.queryHash)).toBeNull()
  })

  test('mixed: only expired rows are deleted, others survive', async () => {
    const userId = 'sweep_test_mixed'

    const expiredRow = await createSavedQuery({ userId, query: 'to-delete', snapshot: null, ttl: now - 1 })
    const futureRow = await createSavedQuery({ userId, query: 'to-keep-future', snapshot: null, ttl: now + 100_000 })
    const alphaRow = await createSavedQuery({ userId, query: 'to-keep-alpha', snapshot: null })

    const result = await sweepExpiredSavedQueries({ now })

    expect(result.deleted).toBe(1)

    // Expired row gone
    expect(await getSavedQuery(userId, expiredRow.submittedAt, expiredRow.queryHash)).toBeNull()

    // Unexpired and alpha rows still present
    expect(await getSavedQuery(userId, futureRow.submittedAt, futureRow.queryHash)).not.toBeNull()
    expect(await getSavedQuery(userId, alphaRow.submittedAt, alphaRow.queryHash)).not.toBeNull()

    const listed = await listSavedQueries(userId)
    expect(listed).toHaveLength(2)
    const queries = listed.map((r) => r.query).sort()
    expect(queries).toEqual(['to-keep-alpha', 'to-keep-future'])
  })

  test('returns { deleted: 0 } when nothing is expired', async () => {
    const userId = 'sweep_test_empty'
    await createSavedQuery({ userId, query: 'no-expiry', snapshot: null })

    const result = await sweepExpiredSavedQueries({ now })
    expect(result.deleted).toBe(0)
  })
})
