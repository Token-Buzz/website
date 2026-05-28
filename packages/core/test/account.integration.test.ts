/**
 * Account data layer integration test — exercises `exportUserData` and
 * `deleteAllUserData` from `packages/core/src/db/account.ts` against a local
 * dynalite DynamoDB.
 *
 * Seeds rows via:
 *  - `createAlert` (real alert helper — writes ALERT# rows under USER#<userId>)
 *  - A raw PutCommand to simulate a BYOK row with a `ciphertext` field
 *
 * Verifies:
 *  - exportUserData returns all rows for the user
 *  - The `ciphertext` field on BYOK rows is replaced with "[redacted]"
 *  - deleteAllUserData removes every row and returns the correct count
 *  - A subsequent exportUserData returns []
 */

import { beforeEach, describe, expect, test } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import { createAlert } from '@monorepo-template/core/db/alerts'
import { exportUserData, deleteAllUserData } from '@monorepo-template/core/db/account'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── exportUserData ─────────────────────────────────────────────────────────────

describe('exportUserData', () => {
  const USER_ID = 'user_export_test'

  test('returns empty array when the user has no data', async () => {
    const data = await exportUserData(USER_ID)
    expect(data).toHaveLength(0)
  })

  test('returns all rows belonging to the user', async () => {
    // Seed two alert rows.
    await createAlert({
      userId: USER_ID,
      symbol: 'BTC',
      condition: 'mention_spike',
      threshold: 50,
    })
    await createAlert({
      userId: USER_ID,
      symbol: 'ETH',
      condition: 'price_move',
      threshold: 10,
    })

    const data = await exportUserData(USER_ID)
    expect(data).toHaveLength(2)

    const symbols = data.map((item) => (item as Record<string, unknown>).symbol)
    expect(symbols).toContain('BTC')
    expect(symbols).toContain('ETH')
  })

  test('does NOT return rows belonging to a different user', async () => {
    await createAlert({
      userId: 'user_other',
      symbol: 'SOL',
      condition: 'mention_spike',
      threshold: 20,
    })
    await createAlert({
      userId: USER_ID,
      symbol: 'ADA',
      condition: 'mention_spike',
      threshold: 30,
    })

    const data = await exportUserData(USER_ID)
    expect(data).toHaveLength(1)
    expect((data[0] as Record<string, unknown>).symbol).toBe('ADA')
  })

  test('redacts the ciphertext field on BYOK rows', async () => {
    // Seed a synthetic BYOK row that mimics what putByokKey writes.
    const byokRow = {
      pk: `USER#${USER_ID}`,
      sk: 'BYOK#twitter',
      userId: USER_ID,
      provider: 'twitter',
      ciphertext: 'SUPER_SECRET_ENCRYPTED_BLOB',
      last4: '1234',
      validatedAt: new Date().toISOString(),
      status: 'active',
      backgroundPolling: false,
      gsi1pk: 'BYOK#twitter',
      gsi1sk: `USER#${USER_ID}`,
    }
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: byokRow,
      }),
    )

    const data = await exportUserData(USER_ID)
    expect(data).toHaveLength(1)

    const exported = data[0] as Record<string, unknown>
    // The ciphertext must be redacted.
    expect(exported.ciphertext).toBe('[redacted]')
    // Non-sensitive fields must be preserved.
    expect(exported.last4).toBe('1234')
    expect(exported.provider).toBe('twitter')
    expect(exported.userId).toBe(USER_ID)
  })

  test('non-BYOK rows are not modified (no ciphertext field added)', async () => {
    await createAlert({
      userId: USER_ID,
      symbol: 'LINK',
      condition: 'mention_spike',
      threshold: 15,
    })

    const data = await exportUserData(USER_ID)
    expect(data).toHaveLength(1)

    const exported = data[0] as Record<string, unknown>
    // No ciphertext field should appear on an alert row.
    expect(exported.ciphertext).toBeUndefined()
  })
})

// ── deleteAllUserData ──────────────────────────────────────────────────────────

describe('deleteAllUserData', () => {
  const USER_ID = 'user_delete_test'

  test('returns 0 when the user has no data', async () => {
    const count = await deleteAllUserData(USER_ID)
    expect(count).toBe(0)
  })

  test('deletes all rows and returns the correct count', async () => {
    await createAlert({
      userId: USER_ID,
      symbol: 'BTC',
      condition: 'mention_spike',
      threshold: 50,
    })
    await createAlert({
      userId: USER_ID,
      symbol: 'ETH',
      condition: 'price_move',
      threshold: 10,
    })
    // Seed a BYOK row as well.
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: {
          pk: `USER#${USER_ID}`,
          sk: 'BYOK#twitter',
          userId: USER_ID,
          provider: 'twitter',
          ciphertext: 'secret_blob',
          last4: '5678',
          validatedAt: new Date().toISOString(),
          status: 'active',
          backgroundPolling: false,
          gsi1pk: 'BYOK#twitter',
          gsi1sk: `USER#${USER_ID}`,
        },
      }),
    )

    const before = await exportUserData(USER_ID)
    expect(before).toHaveLength(3)

    const count = await deleteAllUserData(USER_ID)
    expect(count).toBe(3)

    const after = await exportUserData(USER_ID)
    expect(after).toHaveLength(0)
  })

  test('does NOT delete rows belonging to a different user', async () => {
    const OTHER_USER = 'user_delete_other'
    await createAlert({
      userId: USER_ID,
      symbol: 'SOL',
      condition: 'mention_spike',
      threshold: 25,
    })
    await createAlert({
      userId: OTHER_USER,
      symbol: 'DOT',
      condition: 'price_move',
      threshold: 5,
    })

    await deleteAllUserData(USER_ID)

    // Other user's data must still exist.
    const remaining = await exportUserData(OTHER_USER)
    expect(remaining).toHaveLength(1)
    expect((remaining[0] as Record<string, unknown>).symbol).toBe('DOT')
  })

  test('calling delete twice is idempotent (second call returns 0)', async () => {
    await createAlert({
      userId: USER_ID,
      symbol: 'AVAX',
      condition: 'mention_spike',
      threshold: 40,
    })

    await deleteAllUserData(USER_ID)
    const second = await deleteAllUserData(USER_ID)
    expect(second).toBe(0)
  })
})
