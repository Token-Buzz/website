/**
 * Integration test for ingestion-mode.ts — exercises the real
 * getIngestionSettings / setIngestionSettings functions against a local
 * dynalite DynamoDB.
 *
 * Covers: default when no record; round-trip with apify default + override;
 * overwrite; per-user independence; unknown source in overrides sanitized on read.
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
  getIngestionSettings,
  setIngestionSettings,
} from '@monorepo-template/core/db/ingestion-mode'
import { DEFAULT_INGESTION_SETTINGS } from '@monorepo-template/core/sources/ingestion-mode'

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

describe('getIngestionSettings — default', () => {
  test('returns DEFAULT_INGESTION_SETTINGS when no record exists', async () => {
    const settings = await getIngestionSettings('user_ingest_new')
    expect(settings).toEqual(DEFAULT_INGESTION_SETTINGS)
  })
})

describe('setIngestionSettings / getIngestionSettings round-trips', () => {
  const USER_ID = 'user_ingest_test'

  test('set { default: apify, overrides: { twitter: per-source } } round-trips correctly', async () => {
    await setIngestionSettings(USER_ID, {
      default: 'apify',
      overrides: { twitter: 'per-source' },
    })
    const settings = await getIngestionSettings(USER_ID)
    expect(settings).toEqual({ default: 'apify', overrides: { twitter: 'per-source' } })
  })

  test('overwrite: second write replaces first', async () => {
    await setIngestionSettings(USER_ID, {
      default: 'apify',
      overrides: { twitter: 'per-source' },
    })
    await setIngestionSettings(USER_ID, {
      default: 'per-source',
      overrides: { reddit: 'apify' },
    })
    const settings = await getIngestionSettings(USER_ID)
    expect(settings).toEqual({ default: 'per-source', overrides: { reddit: 'apify' } })
  })

  test('different users have independent settings', async () => {
    await setIngestionSettings('user_ingest_a', {
      default: 'apify',
      overrides: {},
    })
    await setIngestionSettings('user_ingest_b', {
      default: 'per-source',
      overrides: { farcaster: 'apify' },
    })

    const a = await getIngestionSettings('user_ingest_a')
    const b = await getIngestionSettings('user_ingest_b')

    expect(a).toEqual({ default: 'apify', overrides: {} })
    expect(b).toEqual({ default: 'per-source', overrides: { farcaster: 'apify' } })
  })
})

describe('sanitization on read', () => {
  test('unknown source in overrides is sanitized out on read', async () => {
    // Write a row directly with an invalid source key bypassing sanitizeIngestionSettings.
    // We use setIngestionSettings with a valid payload, then manually corrupt the stored
    // overrides by writing a raw PutCommand with an unknown source key.
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb')
    const { ingestionSettingsKey } = await import('@monorepo-template/core/db/keys')

    const USER_ID = 'user_ingest_corrupt'
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: {
          ...ingestionSettingsKey(USER_ID),
          userId: USER_ID,
          default: 'apify',
          overrides: {
            twitter: 'per-source',    // valid — kept
            not_a_source: 'apify',    // unknown source — dropped on read
          },
          updatedAt: new Date().toISOString(),
        },
      }),
    )

    const settings = await getIngestionSettings(USER_ID)
    // The unknown source key must be dropped; only 'twitter' survives.
    expect(settings).toEqual({ default: 'apify', overrides: { twitter: 'per-source' } })
    expect(Object.keys(settings.overrides)).not.toContain('not_a_source')
  })
})
