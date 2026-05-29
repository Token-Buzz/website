/**
 * Integration tests for `packages/core/src/db/monitors.ts`.
 *
 * Exercises putMonitor / getMonitor / listMonitors / deleteMonitor against a
 * real dynalite DynamoDB (the same local server used by the other integration
 * tests).  No AWS credentials or KMS are required.
 */

import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

import {
  putMonitor,
  getMonitor,
  listMonitors,
  listAllMonitors,
  deleteMonitor,
  type Monitor,
} from '@monorepo-template/core/db/monitors'

// ── Helpers ───────────────────────────────────────────────────────────────────

const rawClient = new DynamoDBClient({
  endpoint: 'http://127.0.0.1:8000',
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearUserData(): Promise<void> {
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

function makeMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    userId: 'user_monitor_test',
    query: '$BTC',
    sources: ['twitter'],
    intervalMs: 120_000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('monitors (dynalite integration)', () => {
  beforeEach(async () => {
    await clearUserData()
  })

  test('putMonitor / getMonitor round-trip', async () => {
    const monitor = makeMonitor()
    await putMonitor(monitor)

    const fetched = await getMonitor(monitor.userId, monitor.query)
    expect(fetched).not.toBeNull()
    expect(fetched!.userId).toBe(monitor.userId)
    expect(fetched!.query).toBe(monitor.query)
    expect(fetched!.sources).toEqual(['twitter'])
    expect(fetched!.intervalMs).toBe(120_000)
  })

  test('getMonitor returns null when no record exists', async () => {
    const result = await getMonitor('ghost_user', '$NONEXISTENT')
    expect(result).toBeNull()
  })

  test('putMonitor trims whitespace from query', async () => {
    const monitor = makeMonitor({ query: '  $ETH  ' })
    await putMonitor(monitor)

    // trimmed key is '$ETH'
    const fetched = await getMonitor(monitor.userId, '$ETH')
    expect(fetched).not.toBeNull()
    expect(fetched!.query).toBe('$ETH')
  })

  test('putMonitor drops invalid sources', async () => {
    const monitor = makeMonitor({
      sources: ['twitter', 'not-a-source' as never, 'reddit'],
    })
    await putMonitor(monitor)

    const fetched = await getMonitor(monitor.userId, monitor.query)
    expect(fetched).not.toBeNull()
    // 'not-a-source' is filtered out; 'reddit' is a valid SocialSource even if
    // not yet implemented, so it is kept.
    expect(fetched!.sources).toEqual(['twitter', 'reddit'])
  })

  test('listMonitors returns all monitors for a user', async () => {
    const userId = 'user_list_test'
    await putMonitor(makeMonitor({ userId, query: '$BTC' }))
    await putMonitor(makeMonitor({ userId, query: '$ETH' }))
    await putMonitor(makeMonitor({ userId, query: '$SOL' }))

    const monitors = await listMonitors(userId)
    expect(monitors).toHaveLength(3)
    const queries = monitors.map((m) => m.query).sort()
    expect(queries).toEqual(['$BTC', '$ETH', '$SOL'])
  })

  test("listMonitors returns only the requesting user's monitors", async () => {
    const userA = 'user_scope_a'
    const userB = 'user_scope_b'
    await putMonitor(makeMonitor({ userId: userA, query: '$BTC' }))
    await putMonitor(makeMonitor({ userId: userB, query: '$ETH' }))

    const monitorsA = await listMonitors(userA)
    expect(monitorsA).toHaveLength(1)
    expect(monitorsA[0].query).toBe('$BTC')

    const monitorsB = await listMonitors(userB)
    expect(monitorsB).toHaveLength(1)
    expect(monitorsB[0].query).toBe('$ETH')
  })

  test('listMonitors returns empty array when user has no monitors', async () => {
    const monitors = await listMonitors('user_with_no_monitors')
    expect(monitors).toEqual([])
  })

  test('listMonitors defaults sources to [] and intervalMs to 0 when absent', async () => {
    // Insert a raw item without `sources` or `intervalMs` to simulate old rows.
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb')
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: {
          pk: 'USER#user_legacy',
          sk: 'MONITOR#$LEGACY',
          userId: 'user_legacy',
          query: '$LEGACY',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    )

    const monitors = await listMonitors('user_legacy')
    expect(monitors).toHaveLength(1)
    expect(monitors[0].sources).toEqual([])
    expect(monitors[0].intervalMs).toBe(0)
  })

  test('deleteMonitor removes the record', async () => {
    const monitor = makeMonitor({ query: '$DELETE_ME' })
    await putMonitor(monitor)

    // Confirm it exists first.
    expect(await getMonitor(monitor.userId, '$DELETE_ME')).not.toBeNull()

    await deleteMonitor(monitor.userId, '$DELETE_ME')

    expect(await getMonitor(monitor.userId, '$DELETE_ME')).toBeNull()
  })

  test('deleteMonitor is a no-op when the record does not exist', async () => {
    // Should not throw.
    await expect(deleteMonitor('ghost_user', '$PHANTOM')).resolves.toBeUndefined()
  })

  test('listAllMonitors returns a monitor written by putMonitor (GSI round-trip)', async () => {
    const monitor = makeMonitor({ userId: 'user_gsi_a', query: '$BTC', sources: ['farcaster'] })
    await putMonitor(monitor)

    const all = await listAllMonitors()
    const found = all.find((m) => m.userId === 'user_gsi_a' && m.query === '$BTC')
    expect(found).toBeDefined()
    expect(found!.sources).toEqual(['farcaster'])
    expect(found!.intervalMs).toBe(120_000)
  })

  test('listAllMonitors returns monitors from multiple users', async () => {
    await putMonitor(makeMonitor({ userId: 'user_gsi_b', query: '$ETH', sources: ['twitter'] }))
    await putMonitor(makeMonitor({ userId: 'user_gsi_c', query: '$SOL', sources: ['farcaster'] }))

    const all = await listAllMonitors()
    const userIds = all.map((m) => m.userId)
    expect(userIds).toContain('user_gsi_b')
    expect(userIds).toContain('user_gsi_c')
  })

  test('putMonitor overwrites an existing record (upsert)', async () => {
    const monitor = makeMonitor({ intervalMs: 60_000, sources: ['twitter'] })
    await putMonitor(monitor)

    const updated = { ...monitor, intervalMs: 300_000, sources: ['twitter', 'farcaster'] as const }
    await putMonitor(updated)

    const fetched = await getMonitor(monitor.userId, monitor.query)
    expect(fetched!.intervalMs).toBe(300_000)
    expect(fetched!.sources).toEqual(['twitter', 'farcaster'])
  })
})
