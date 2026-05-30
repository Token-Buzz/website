/**
 * Integration tests for the Apify path in `packages/core/src/db/monitor-poll.ts`.
 *
 * Exercises `getMonitorAssignments` for the 'apify' ingestion mode against a
 * real dynalite DynamoDB. KMS is mocked with the same reversible stub used in
 * byok-poll.integration.test.ts (base64 "encryption") so the offline tests
 * work without AWS credentials.
 *
 * Scenarios:
 *  1. Apify holder + default:'apify' settings + Monitor {sources:['reddit']}
 *     → yields a task { source:'reddit', mode:'apify', apiKey:<decrypted> }.
 *  2. User with BOTH a direct twitter key AND an apify key, settings default:'apify'
 *     → twitter task has mode:'apify', NO mode:'per-source' twitter task (mutual exclusivity).
 *  3. User with default:'per-source' but overrides:{ reddit:'apify' } and both
 *     reddit + apify keys → reddit task has mode:'apify', other sources stay 'per-source'.
 *  4. Entitlement: a plan that does not meet a source's minPlan yields no task for it.
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
import { putMonitor } from '@monorepo-template/core/db/monitors'
import { setIngestionSettings } from '@monorepo-template/core/db/ingestion-mode'
import { getMonitorAssignments } from '@monorepo-template/core/db/monitor-poll'
import { APIFY_PROVIDER } from '@monorepo-template/core/providers'

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

describe('getMonitorAssignments — Apify path (dynalite integration)', () => {
  beforeEach(async () => {
    await clearUserData()
    vi.clearAllMocks()
  })

  test('scenario 1: Apify holder + default:apify + Monitor{sources:[reddit]} yields mode:apify task', async () => {
    const userId = 'user_apify_sc1'

    // Store an Apify BYOK key with backgroundPolling=true
    await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: 'apify_token_sc1_1234' })
    await setByokBackgroundPolling(userId, APIFY_PROVIDER, true)

    // Set ingestion settings: everything goes through Apify
    await setIngestionSettings(userId, { default: 'apify', overrides: {} })

    // Add a monitor for 'SOL' on reddit
    await putMonitor({
      userId,
      query: 'SOL',
      sources: ['reddit'],
      intervalMs: 120_000,
      enabled: true,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const redditTasks = tasks.filter((t) => t.source === 'reddit' && t.userId === userId)
    expect(redditTasks).toHaveLength(1)
    expect(redditTasks[0].query).toBe('SOL')
    expect(redditTasks[0].mode).toBe('apify')
    expect(redditTasks[0].apiKey).toBe('apify_token_sc1_1234')
  })

  test('scenario 2: user with both twitter+apify keys and default:apify → twitter task is mode:apify, no mode:per-source twitter task', async () => {
    const userId = 'user_apify_sc2'

    // Direct twitter BYOK key (opted in)
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'twitter_key_sc2' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)

    // Apify key (opted in)
    await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: 'apify_token_sc2_5678' })
    await setByokBackgroundPolling(userId, APIFY_PROVIDER, true)

    // Mode: everything via Apify (including twitter)
    await setIngestionSettings(userId, { default: 'apify', overrides: {} })

    // Monitor for twitter
    await putMonitor({
      userId,
      query: '$BTC',
      sources: ['twitter'],
      intervalMs: 120_000,
      enabled: true,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const userTasks = tasks.filter((t) => t.userId === userId && t.source === 'twitter')

    // Should have exactly one twitter task, and it must be apify mode
    expect(userTasks).toHaveLength(1)
    expect(userTasks[0].mode).toBe('apify')
    expect(userTasks[0].apiKey).toBe('apify_token_sc2_5678')

    // Verify NO per-source twitter task exists for this user
    const perSourceTasks = userTasks.filter((t) => t.mode === 'per-source')
    expect(perSourceTasks).toHaveLength(0)
  })

  test('scenario 3: default:per-source but overrides:{reddit:apify} → reddit=apify, other sources=per-source', async () => {
    const userId = 'user_apify_sc3'

    // Per-source BYOK keys for reddit (unused in apify mode) and twitter
    await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: 'twitter_key_sc3' })
    await setByokBackgroundPolling(userId, TWITTER_PROVIDER, true)

    // Apify key
    await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: 'apify_token_sc3_abcd' })
    await setByokBackgroundPolling(userId, APIFY_PROVIDER, true)

    // Mixed mode: default is per-source, but reddit goes through Apify
    await setIngestionSettings(userId, { default: 'per-source', overrides: { reddit: 'apify' } })

    // Monitor for reddit + twitter (same query, both sources)
    await putMonitor({
      userId,
      query: '$ETH',
      sources: ['reddit', 'twitter'],
      intervalMs: 120_000,
      enabled: true,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const userTasks = tasks.filter((t) => t.userId === userId)

    // reddit should be mode:apify
    const redditTasks = userTasks.filter((t) => t.source === 'reddit')
    expect(redditTasks).toHaveLength(1)
    expect(redditTasks[0].mode).toBe('apify')
    expect(redditTasks[0].apiKey).toBe('apify_token_sc3_abcd')

    // twitter should be mode:per-source (using the twitter direct key)
    const twitterTasks = userTasks.filter((t) => t.source === 'twitter')
    expect(twitterTasks).toHaveLength(1)
    expect(twitterTasks[0].mode).toBe('per-source')
    expect(twitterTasks[0].apiKey).toBe('twitter_key_sc3')
  })

  test('scenario 4: entitlement respected — a plan not meeting source minPlan yields no task', async () => {
    const userId = 'user_apify_sc4'

    // Apify key with backgroundPolling
    await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: 'apify_token_sc4_zzzz' })
    await setByokBackgroundPolling(userId, APIFY_PROVIDER, true)

    // Apify mode
    await setIngestionSettings(userId, { default: 'apify', overrides: {} })

    // Monitor for telegram — whose minPlan is 'alpha', but this user is on 'free'
    // (no plan record in DB → getUserPlan returns 'free' by default)
    await putMonitor({
      userId,
      query: '$DOT',
      sources: ['telegram'],
      intervalMs: 120_000,
      enabled: true,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    // No telegram task should be emitted — plan gate blocks it
    const telegramTasks = tasks.filter((t) => t.source === 'telegram' && t.userId === userId)
    expect(telegramTasks).toHaveLength(0)
  })

  test('Apify holder not opted in (backgroundPolling=false) yields no apify tasks', async () => {
    const userId = 'user_apify_optout'

    // Apify key but NOT opted in for background polling
    await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: 'apify_token_optout' })
    // backgroundPolling defaults to false — do not call setByokBackgroundPolling

    await setIngestionSettings(userId, { default: 'apify', overrides: {} })
    await putMonitor({
      userId,
      query: '$LINK',
      sources: ['reddit'],
      intervalMs: 120_000,
      enabled: true,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const userTasks = tasks.filter((t) => t.userId === userId)
    expect(userTasks).toHaveLength(0)
  })

  test('paused apify monitor (enabled=false) yields no task', async () => {
    const userId = 'user_apify_paused'

    await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: 'apify_token_paused' })
    await setByokBackgroundPolling(userId, APIFY_PROVIDER, true)
    await setIngestionSettings(userId, { default: 'apify', overrides: {} })

    await putMonitor({
      userId,
      query: '$UNI',
      sources: ['reddit'],
      intervalMs: 120_000,
      enabled: false,
      createdAt: iso(),
      updatedAt: iso(),
    })

    const tasks = await getMonitorAssignments()

    const userTasks = tasks.filter((t) => t.userId === userId)
    expect(userTasks).toHaveLength(0)
  })

  test('two apify holders monitoring the same query are deduped to a single task', async () => {
    const userA = 'user_apify_dedup_a'
    const userB = 'user_apify_dedup_b'

    for (const userId of [userA, userB]) {
      await putByokKey({ userId, provider: APIFY_PROVIDER, apiKey: `apify_token_${userId}` })
      await setByokBackgroundPolling(userId, APIFY_PROVIDER, true)
      await setIngestionSettings(userId, { default: 'apify', overrides: {} })
      await putMonitor({
        userId,
        query: '$SOL',
        sources: ['reddit'],
        intervalMs: 120_000,
        enabled: true,
        createdAt: iso(),
        updatedAt: iso(),
      })
    }

    const tasks = await getMonitorAssignments()

    const solRedditTasks = tasks.filter((t) => t.source === 'reddit' && t.query === '$SOL' && t.mode === 'apify')
    // Exactly one task after dedup
    expect(solRedditTasks).toHaveLength(1)
    expect([userA, userB]).toContain(solRedditTasks[0].userId)
  })
})
