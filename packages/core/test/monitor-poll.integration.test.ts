/**
 * Integration tests for `packages/core/src/db/monitor-poll.ts`.
 *
 * Exercises `getMonitorAssignments` against a real dynalite DynamoDB.
 * KMS is mocked with the same reversible stub used in byok-poll.integration.test.ts
 * (base64 "encryption") so the offline tests work without AWS credentials.
 *
 * Scenarios:
 *  1. Active, opted-in holder with a Monitor {sources:['twitter']} → yields a
 *     twitter MonitorTask for that query with the decrypted key.
 *  2. Active, opted-in holder with NO monitor records but a watchlist → FALLBACK
 *     yields a twitter task (pre-M9 behaviour preserved).
 *  3. A Monitor that lists only a non-implemented source (e.g. 'reddit') yields
 *     NO task (reddit is not implemented in Phase 1).
 *  4. Two holders both monitoring the same query (twitter) → deduped to a single
 *     task.
 *  5. Opted-out holder (backgroundPolling=false) → no tasks.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

// Inject the fake KMS client BEFORE any import that touches crypto.ts so the
// module-level singleton is replaced before it is ever used.
import { _setKmsClient } from '@monorepo-template/core/lib/crypto'
import { KMSClient } from '@aws-sdk/client-kms'

// Reversible stub: "encrypt" = base64(plaintext), "decrypt" = base64-decode.
const fakeKmsClient = {
  send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
    if ('Plaintext' in cmd.input && cmd.input.Plaintext !== undefined) {
      const encrypted = Buffer.from(cmd.input.Plaintext as Uint8Array).toString('base64')
      return { CiphertextBlob: Buffer.from(encrypted, 'utf-8') }
    }
    if ('CiphertextBlob' in cmd.input && cmd.input.CiphertextBlob !== undefined) {
      const base64Plaintext = Buffer.from(cmd.input.CiphertextBlob as Uint8Array).toString('utf-8')
      const plaintext = Buffer.from(base64Plaintext, 'base64')
      return { Plaintext: plaintext }
    }
    throw new Error('Unknown KMS command in fake client')
  }),
} as unknown as KMSClient

_setKmsClient(fakeKmsClient)
process.env.BYOK_KMS_KEY_ID = 'arn:aws:kms:us-east-1:000000000000:key/test'

// Import functions under test AFTER the fake KMS client is wired.
import {
  putByokKey,
  setByokBackgroundPolling,
  TWITTER_PROVIDER,
} from '@monorepo-template/core/db/byok'
import { putWatchlist } from '@monorepo-template/core/db/user-data'
import { putMonitor } from '@monorepo-template/core/db/monitors'
import { getMonitorAssignments } from '@monorepo-template/core/db/monitor-poll'

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

function iso(): string {
  return new Date().toISOString()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getMonitorAssignments (dynalite integration)', () => {
  beforeEach(async () => {
    await clearUserData()
    vi.clearAllMocks()
  })

  test('scenario 1: active opted-in holder with Monitor {sources:[twitter]} yields a MonitorTask', async () => {
    const userId = 'user_monitor_a'
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'key_a_1234' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)
    await putMonitor({
      userId,
      query: '$BTC',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const twitterTasks = tasks.filter((t) => t.source === 'twitter' && t.userId === userId)
    expect(twitterTasks).toHaveLength(1)
    expect(twitterTasks[0].query).toBe('$BTC')
    expect(twitterTasks[0].apiKey).toBe('key_a_1234')
  })

  test('scenario 2: holder with NO monitor records falls back to watchlist queries (twitter only)', async () => {
    const userId = 'user_fallback_b'
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'key_b_5678' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)
    // No putMonitor — only a watchlist (pre-M9 pattern).
    await putWatchlist({
      id: 'wl1',
      userId,
      name: 'My list',
      queries: ['$ETH'],
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const twitterTasks = tasks.filter((t) => t.source === 'twitter' && t.userId === userId)
    expect(twitterTasks).toHaveLength(1)
    expect(twitterTasks[0].query).toBe('$ETH')
    expect(twitterTasks[0].apiKey).toBe('key_b_5678')
  })

  test('scenario 3: Monitor listing only a non-implemented source yields no task', async () => {
    const userId = 'user_reddit_c'
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'key_c_abcd' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)
    // Monitor for reddit only — reddit is not implemented in Phase 1.
    await putMonitor({
      userId,
      query: '$SOL',
      sources: ['reddit'],
      intervalMs: 300_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    // No twitter task for this user (their only monitor is for reddit, and they
    // DO have monitor records so the twitter fallback does NOT apply).
    const userTasks = tasks.filter((t) => t.userId === userId)
    expect(userTasks).toHaveLength(0)
  })

  test('scenario 4: two holders both monitoring the same query are deduped to a single task', async () => {
    const userA = 'user_dedup_a'
    const userB = 'user_dedup_b'

    await putByokKey({ userId: userA, provider: TWITTER_PROVIDER, apiKey: 'key_dedup_a' })
    await setByokBackgroundPolling(userA, TWITTER_PROVIDER, true)
    await putMonitor({
      userId: userA,
      query: '$DOGE',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    await putByokKey({ userId: userB, provider: TWITTER_PROVIDER, apiKey: 'key_dedup_b' })
    await setByokBackgroundPolling(userB, TWITTER_PROVIDER, true)
    await putMonitor({
      userId: userB,
      query: '$DOGE',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const dogeTasks = tasks.filter((t) => t.source === 'twitter' && t.query === '$DOGE')
    // Exactly one task for $DOGE — the dedup assigns it to the first holder only.
    expect(dogeTasks).toHaveLength(1)
    // The assigned user is either A or B (whichever the GSI returns first).
    expect(['user_dedup_a', 'user_dedup_b']).toContain(dogeTasks[0].userId)
  })

  test('scenario 5: opted-out holder yields no tasks', async () => {
    const userId = 'user_optout_d'
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'key_optout_d' })
    // backgroundPolling defaults to false — not opting in.
    await putMonitor({
      userId,
      query: '$PEPE',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const userTasks = tasks.filter((t) => t.userId === userId)
    expect(userTasks).toHaveLength(0)
  })

  test('returns empty array when no BYOK holders exist', async () => {
    const tasks = await getMonitorAssignments()
    expect(tasks).toHaveLength(0)
  })

  // ── Keyless (farcaster) scenarios ────────────────────────────────────────────

  test('farcaster: user with Monitor {sources:[farcaster]} and NO BYOK key yields a farcaster task with apiKey=""', async () => {
    const userId = 'user_farcaster_a'
    await putMonitor({
      userId,
      query: '$BTC',
      sources: ['farcaster'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const farcasterTasks = tasks.filter((t) => t.source === 'farcaster' && t.userId === userId)
    expect(farcasterTasks).toHaveLength(1)
    expect(farcasterTasks[0].query).toBe('$BTC')
    expect(farcasterTasks[0].apiKey).toBe('')
  })

  test('farcaster: two users monitoring the same query are deduped to exactly one task', async () => {
    const userA = 'user_farc_dedup_a'
    const userB = 'user_farc_dedup_b'
    await putMonitor({
      userId: userA,
      query: '$ETH',
      sources: ['farcaster'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })
    await putMonitor({
      userId: userB,
      query: '$ETH',
      sources: ['farcaster'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const ethFarcasterTasks = tasks.filter((t) => t.source === 'farcaster' && t.query === '$ETH')
    expect(ethFarcasterTasks).toHaveLength(1)
    expect([userA, userB]).toContain(ethFarcasterTasks[0].userId)
  })

  test('farcaster: a user whose only monitor is {sources:[twitter]} yields NO farcaster task', async () => {
    const userId = 'user_farc_twitter_only'
    // Give the user a BYOK key so the twitter path might produce tasks.
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'key_twit_only' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)
    await putMonitor({
      userId,
      query: '$DOGE',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const farcasterTasks = tasks.filter((t) => t.source === 'farcaster' && t.userId === userId)
    expect(farcasterTasks).toHaveLength(0)
    // The twitter task for this user should still be present.
    const twitterTasks = tasks.filter((t) => t.source === 'twitter' && t.userId === userId)
    expect(twitterTasks).toHaveLength(1)
  })

  test('multiple queries in a single monitor expand to multiple tasks', async () => {
    // putMonitor stores one record per query — put two.
    const userId = 'user_multi_e'
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'key_multi_e' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)
    await putMonitor({
      userId,
      query: '$BTC',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })
    await putMonitor({
      userId,
      query: '$ETH',
      sources: ['twitter'],
      intervalMs: 120_000,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const userTasks = tasks.filter((t) => t.userId === userId && t.source === 'twitter')
    expect(userTasks).toHaveLength(2)
    const queries = userTasks.map((t) => t.query).sort()
    expect(queries).toEqual(['$BTC', '$ETH'])
  })
})
