/**
 * Integration test for `packages/core/src/db/byok-poll.ts`.
 *
 * Exercises `getPollAssignments` against a real dynalite DynamoDB, including
 * the ByokHolders GSI query and the write→read decryption round-trip.
 *
 * KMS is mocked with the same reversible stub used in byok.integration.test.ts
 * (base64 "encryption") so the offline tests work without AWS credentials.
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
  markByokKeyInvalid,
  TWITTER_PROVIDER,
} from '@monorepo-template/core/db/byok'
import { putWatchlist } from '@monorepo-template/core/db/user-data'
import { getPollAssignments } from '@monorepo-template/core/db/byok-poll'

// ── Helpers ──────────────────────────────────────────────────────────────────

const rawClient = new DynamoDBClient({
  endpoint: 'http://127.0.0.1:8000',
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

function iso() {
  return new Date().toISOString()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getPollAssignments (dynalite integration)', () => {
  beforeEach(async () => {
    await clearUserData()
    vi.clearAllMocks()
  })

  test('returns only active, opted-in holders with decrypted keys and deduped queries', async () => {
    // Holder A — active, opted-in, queries: $BTC + $ETH
    await putByokKey({ userId: 'user_a', provider: TWITTER_PROVIDER, apiKey: 'key_a_aaaa' })
    await setByokBackgroundPolling('user_a', TWITTER_PROVIDER, true)
    await putWatchlist({ id: 'w1', userId: 'user_a', name: 'wl', queries: ['$BTC', '$ETH'], createdAt: iso(), updatedAt: iso() })

    // Holder B — active, opted-in, queries: $BTC + $SOL ($BTC is shared with A)
    await putByokKey({ userId: 'user_b', provider: TWITTER_PROVIDER, apiKey: 'key_b_bbbb' })
    await setByokBackgroundPolling('user_b', TWITTER_PROVIDER, true)
    await putWatchlist({ id: 'w2', userId: 'user_b', name: 'wl', queries: ['$BTC', '$SOL'], createdAt: iso(), updatedAt: iso() })

    // Holder C — active, NOT opted-in (backgroundPolling stays false)
    await putByokKey({ userId: 'user_c', provider: TWITTER_PROVIDER, apiKey: 'key_c_cccc' })
    await putWatchlist({ id: 'w3', userId: 'user_c', name: 'wl', queries: ['$DOGE'], createdAt: iso(), updatedAt: iso() })

    // Holder D — opted-in but then marked invalid
    await putByokKey({ userId: 'user_d', provider: TWITTER_PROVIDER, apiKey: 'key_d_dddd' })
    await setByokBackgroundPolling('user_d', TWITTER_PROVIDER, true)
    await markByokKeyInvalid('user_d', TWITTER_PROVIDER)
    await putWatchlist({ id: 'w4', userId: 'user_d', name: 'wl', queries: ['$PEPE'], createdAt: iso(), updatedAt: iso() })

    // Holder E — opted-in + active, but NO watchlist queries
    await putByokKey({ userId: 'user_e', provider: TWITTER_PROVIDER, apiKey: 'key_e_eeee' })
    await setByokBackgroundPolling('user_e', TWITTER_PROVIDER, true)
    // (no putWatchlist for user_e)

    const assignments = await getPollAssignments(TWITTER_PROVIDER)

    // Only A and B should appear.
    expect(assignments).toHaveLength(2)

    const byUser = Object.fromEntries(assignments.map((a) => [a.userId, a]))

    // C excluded: not opted-in.
    expect(byUser['user_c']).toBeUndefined()

    // D excluded: key is invalid.
    expect(byUser['user_d']).toBeUndefined()

    // E excluded: no watchlist queries.
    expect(byUser['user_e']).toBeUndefined()

    // A gets $BTC and $ETH (first holder, wins the $BTC dedup).
    expect(byUser['user_a']).toBeDefined()
    expect(byUser['user_a'].queries.sort()).toEqual(['$BTC', '$ETH'].sort())
    expect(byUser['user_a'].apiKey).toBe('key_a_aaaa')

    // B gets $SOL only ($BTC was already claimed by A).
    expect(byUser['user_b']).toBeDefined()
    expect(byUser['user_b'].queries).toEqual(['$SOL'])
    expect(byUser['user_b'].apiKey).toBe('key_b_bbbb')
  })

  test('returns empty array when no eligible holders exist', async () => {
    const assignments = await getPollAssignments(TWITTER_PROVIDER)
    expect(assignments).toHaveLength(0)
  })

  test('returns empty array when all holders are opted-out', async () => {
    await putByokKey({ userId: 'user_optout', provider: TWITTER_PROVIDER, apiKey: 'key_optout_1234' })
    // backgroundPolling defaults to false — no explicit setByokBackgroundPolling call

    const assignments = await getPollAssignments(TWITTER_PROVIDER)
    expect(assignments).toHaveLength(0)
  })

  test('returns empty array when all opted-in holders have invalid keys', async () => {
    await putByokKey({ userId: 'user_invalid', provider: TWITTER_PROVIDER, apiKey: 'key_invalid_5678' })
    await setByokBackgroundPolling('user_invalid', TWITTER_PROVIDER, true)
    await markByokKeyInvalid('user_invalid', TWITTER_PROVIDER)
    await putWatchlist({ id: 'w_inv', userId: 'user_invalid', name: 'wl', queries: ['$XRP'], createdAt: iso(), updatedAt: iso() })

    const assignments = await getPollAssignments(TWITTER_PROVIDER)
    expect(assignments).toHaveLength(0)
  })

  test('scoped to provider — holder with a different provider key does not appear', async () => {
    await putByokKey({ userId: 'user_discord', provider: 'discord', apiKey: 'key_discord_1234' })
    await setByokBackgroundPolling('user_discord', 'discord', true)
    await putWatchlist({ id: 'w_dc', userId: 'user_discord', name: 'wl', queries: ['$ETH'], createdAt: iso(), updatedAt: iso() })

    const assignments = await getPollAssignments(TWITTER_PROVIDER)
    expect(assignments).toHaveLength(0)
  })
})
