/**
 * BYOK integration test — exercises the real `packages/core/src/db/byok.ts`
 * functions (putByokKey, getByokKey, hasByokKey, deleteByokKey, listKeyHolders)
 * against a local dynalite DynamoDB, including the ByokHolders GSI query.
 *
 * KMS is mocked with a reversible stub so the write→read round-trip works fully
 * offline without AWS credentials. The stub is injected via `_setKmsClient` so
 * the real production `encryptSecret`/`decryptSecret` functions are exercised
 * end-to-end, with only the KMS network call intercepted.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

// Inject a fake KMS client BEFORE importing byok.ts so crypto.ts uses it.
// _setKmsClient replaces the module-level kmsClient and is the seam designed
// for exactly this purpose.
import { _setKmsClient } from '@monorepo-template/core/lib/crypto'
import { KMSClient } from '@aws-sdk/client-kms'

// Reversible stub: "encrypt" = base64(plaintext), "decrypt" = base64-decode.
// This lets us verify the round-trip without touching AWS.
const fakeKmsClient = {
  send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
    // EncryptCommand carries .input.Plaintext (Uint8Array / Buffer)
    if ('Plaintext' in cmd.input && cmd.input.Plaintext !== undefined) {
      const encrypted = Buffer.from(cmd.input.Plaintext as Uint8Array).toString('base64')
      // Return as Uint8Array so Buffer.from(...) in crypto.ts works correctly.
      return { CiphertextBlob: Buffer.from(encrypted, 'utf-8') }
    }
    // DecryptCommand carries .input.CiphertextBlob (Uint8Array / Buffer)
    if ('CiphertextBlob' in cmd.input && cmd.input.CiphertextBlob !== undefined) {
      // The ciphertext stored is base64(plaintext-bytes), encoded as utf-8 bytes.
      const base64Plaintext = Buffer.from(cmd.input.CiphertextBlob as Uint8Array).toString('utf-8')
      const plaintext = Buffer.from(base64Plaintext, 'base64')
      return { Plaintext: plaintext }
    }
    throw new Error('Unknown KMS command in fake client')
  }),
} as unknown as KMSClient

// Wire the fake before crypto.ts creates its first real client.
_setKmsClient(fakeKmsClient)
process.env.BYOK_KMS_KEY_ID = 'arn:aws:kms:us-east-1:000000000000:key/test'

// Import the functions under test AFTER the fake is wired.
import {
  putByokKey,
  getByokKey,
  deleteByokKey,
  hasByokKey,
  listKeyHolders,
  getByokKeyStatus,
  markByokKeyInvalid,
  setByokBackgroundPolling,
  TWITTER_PROVIDER,
} from '@monorepo-template/core/db/byok'

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
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BYOK DB layer (dynalite integration)', () => {
  const USER_ID = 'user_test_123'
  const PROVIDER = 'twitter'
  const API_KEY = 'twitterapiio_abcdef1234'

  test('putByokKey → getByokKey returns the original key with correct last4 and status', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    const result = await getByokKey(USER_ID, PROVIDER)
    expect(result).not.toBeNull()
    expect(result!.apiKey).toBe(API_KEY)
    expect(result!.last4).toBe(API_KEY.slice(-4))
    expect(result!.status).toBe('active')
    expect(result!.validatedAt).toBeTruthy()
  })

  test('hasByokKey returns true when a key exists, false otherwise', async () => {
    expect(await hasByokKey(USER_ID, PROVIDER)).toBe(false)

    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    expect(await hasByokKey(USER_ID, PROVIDER)).toBe(true)
  })

  test('deleteByokKey removes the item so getByokKey returns null', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })
    expect(await hasByokKey(USER_ID, PROVIDER)).toBe(true)

    await deleteByokKey(USER_ID, PROVIDER)

    expect(await hasByokKey(USER_ID, PROVIDER)).toBe(false)
    expect(await getByokKey(USER_ID, PROVIDER)).toBeNull()
  })

  test('listKeyHolders returns the holder via the ByokHolders GSI', async () => {
    // Two users, same provider — both must appear.
    const USER_A = 'user_a'
    const USER_B = 'user_b'
    await putByokKey({ userId: USER_A, provider: PROVIDER, apiKey: 'key_for_a_1234' })
    await putByokKey({ userId: USER_B, provider: PROVIDER, apiKey: 'key_for_b_5678' })

    const holders = await listKeyHolders(PROVIDER)
    expect(holders).toHaveLength(2)

    const userIds = holders.map((h) => h.userId).sort()
    expect(userIds).toContain(USER_A)
    expect(userIds).toContain(USER_B)
    holders.forEach((h) => expect(h.status).toBe('active'))
  })

  test('listKeyHolders returns empty array when no keys exist for a provider', async () => {
    const holders = await listKeyHolders('nonexistent_provider')
    expect(holders).toHaveLength(0)
  })

  test('listKeyHolders is scoped to the requested provider', async () => {
    await putByokKey({ userId: USER_ID, provider: 'twitter', apiKey: 'tw_key_abcd' })
    await putByokKey({ userId: USER_ID, provider: 'discord', apiKey: 'dc_key_efgh' })

    const twitterHolders = await listKeyHolders('twitter')
    expect(twitterHolders).toHaveLength(1)
    expect(twitterHolders[0].userId).toBe(USER_ID)

    const discordHolders = await listKeyHolders('discord')
    expect(discordHolders).toHaveLength(1)
    expect(discordHolders[0].userId).toBe(USER_ID)
  })

  test('putByokKey includes gsi1pk/gsi1sk so the ByokHolders index query works', async () => {
    // This test directly verifies the bug the integration harness exists to
    // catch: if gsi1pk/gsi1sk are omitted from the write, the GSI query
    // returns zero items even though the item exists on the base table.
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    const holders = await listKeyHolders(PROVIDER)
    expect(holders.length).toBeGreaterThan(0)
    expect(holders[0].userId).toBe(USER_ID)
  })
})

describe('getByokKeyStatus', () => {
  const USER_ID = 'user_status_test'
  const PROVIDER = TWITTER_PROVIDER
  const API_KEY = 'twitterapiio_statustest9876'

  beforeEach(async () => {
    // clearUserData is already called by the outer beforeEach; this scope
    // inherits it. Re-declare a local beforeEach only if needed — the outer
    // one already clears between tests.
  })

  test('returns last4, validatedAt, and status after putByokKey', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    const result = await getByokKeyStatus(USER_ID, PROVIDER)
    expect(result).not.toBeNull()
    expect(result!.last4).toBe(API_KEY.slice(-4))
    expect(result!.status).toBe('active')
    expect(result!.validatedAt).toBeTruthy()
  })

  test('returned object does NOT contain ciphertext (projection excludes the secret)', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    const result = await getByokKeyStatus(USER_ID, PROVIDER)
    expect(result).not.toBeNull()
    expect((result as unknown as Record<string, unknown>).ciphertext).toBeUndefined()
  })

  test('returns null when no key exists for that user/provider', async () => {
    const result = await getByokKeyStatus('no_such_user', PROVIDER)
    expect(result).toBeNull()
  })
})

describe('markByokKeyInvalid', () => {
  const USER_ID = 'user_invalidate_test'
  const PROVIDER = TWITTER_PROVIDER
  const API_KEY = 'twitterapiio_invalidtest1234'

  test('changes status to invalid while preserving last4', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    await markByokKeyInvalid(USER_ID, PROVIDER)

    const result = await getByokKeyStatus(USER_ID, PROVIDER)
    expect(result).not.toBeNull()
    expect(result!.status).toBe('invalid')
    expect(result!.last4).toBe(API_KEY.slice(-4))
  })

  test('row remains visible to listKeyHolders after marking invalid (GSI keys preserved)', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    await markByokKeyInvalid(USER_ID, PROVIDER)

    const holders = await listKeyHolders(PROVIDER)
    const match = holders.find((h) => h.userId === USER_ID)
    expect(match).toBeDefined()
    expect(match!.status).toBe('invalid')
  })

  test('calling on a non-existent key does not throw and does not create a phantom row', async () => {
    // No putByokKey — row does not exist.
    await expect(markByokKeyInvalid('no_such_user', PROVIDER)).resolves.toBeUndefined()

    // Must not have created a phantom item.
    const result = await getByokKeyStatus('no_such_user', PROVIDER)
    expect(result).toBeNull()
  })
})

describe('backgroundPolling opt-in', () => {
  const USER_ID = 'user_bgpoll_test'
  const PROVIDER = TWITTER_PROVIDER
  const API_KEY = 'twitterapiio_bgpolltest1234'

  test('putByokKey defaults backgroundPolling to false', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    const status = await getByokKeyStatus(USER_ID, PROVIDER)
    expect(status).not.toBeNull()
    expect(status!.backgroundPolling).toBe(false)
  })

  test('setByokBackgroundPolling(true) is reflected in getByokKeyStatus', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })

    await setByokBackgroundPolling(USER_ID, PROVIDER, true)

    const status = await getByokKeyStatus(USER_ID, PROVIDER)
    expect(status).not.toBeNull()
    expect(status!.backgroundPolling).toBe(true)
  })

  test('setByokBackgroundPolling(true) is reflected in listKeyHolders', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })
    await setByokBackgroundPolling(USER_ID, PROVIDER, true)

    const holders = await listKeyHolders(PROVIDER)
    const match = holders.find((h) => h.userId === USER_ID)
    expect(match).toBeDefined()
    expect(match!.backgroundPolling).toBe(true)
  })

  test('setByokBackgroundPolling can be toggled back to false', async () => {
    await putByokKey({ userId: USER_ID, provider: PROVIDER, apiKey: API_KEY })
    await setByokBackgroundPolling(USER_ID, PROVIDER, true)
    await setByokBackgroundPolling(USER_ID, PROVIDER, false)

    const status = await getByokKeyStatus(USER_ID, PROVIDER)
    expect(status!.backgroundPolling).toBe(false)
  })

  test('setByokBackgroundPolling on a non-existent key is a no-op (no throw, status stays null)', async () => {
    // No putByokKey — row does not exist.
    await expect(
      setByokBackgroundPolling('no_such_user', PROVIDER, true),
    ).resolves.toBeUndefined()

    const status = await getByokKeyStatus('no_such_user', PROVIDER)
    expect(status).toBeNull()
  })
})
