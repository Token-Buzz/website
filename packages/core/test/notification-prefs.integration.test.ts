/**
 * Integration test for notification-prefs.ts — exercises the real
 * getNotificationPrefs / setNotificationPrefs functions against a local
 * dynalite DynamoDB.
 *
 * Covers: default opt-out, set true round-trip, set false round-trip.
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
  getNotificationPrefs,
  setNotificationPrefs,
} from '@monorepo-template/core/db/notification-prefs'

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getNotificationPrefs — default', () => {
  test('returns emailAlerts:false when no record exists (opt-in default)', async () => {
    const prefs = await getNotificationPrefs('user_notif_new')
    expect(prefs).toEqual({ emailAlerts: false })
  })
})

describe('setNotificationPrefs / getNotificationPrefs round-trips', () => {
  const USER_ID = 'user_notif_test'

  test('set true → get returns emailAlerts:true', async () => {
    await setNotificationPrefs(USER_ID, { emailAlerts: true })
    const prefs = await getNotificationPrefs(USER_ID)
    expect(prefs.emailAlerts).toBe(true)
  })

  test('set false → get returns emailAlerts:false', async () => {
    // First set to true, then set back to false.
    await setNotificationPrefs(USER_ID, { emailAlerts: true })
    await setNotificationPrefs(USER_ID, { emailAlerts: false })
    const prefs = await getNotificationPrefs(USER_ID)
    expect(prefs.emailAlerts).toBe(false)
  })

  test('overwrite: set true twice then false — returns false', async () => {
    await setNotificationPrefs(USER_ID, { emailAlerts: true })
    await setNotificationPrefs(USER_ID, { emailAlerts: true })
    await setNotificationPrefs(USER_ID, { emailAlerts: false })
    const prefs = await getNotificationPrefs(USER_ID)
    expect(prefs.emailAlerts).toBe(false)
  })

  test('different users have independent prefs', async () => {
    await setNotificationPrefs('user_a', { emailAlerts: true })
    await setNotificationPrefs('user_b', { emailAlerts: false })

    expect((await getNotificationPrefs('user_a')).emailAlerts).toBe(true)
    expect((await getNotificationPrefs('user_b')).emailAlerts).toBe(false)
  })
})
