import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { byokKey } from './keys'
import { encryptSecret, decryptSecret } from '../lib/crypto'

// Canonical provider id for the only BYOK provider currently enabled (twitterapi.io).
export const TWITTER_PROVIDER = 'twitter'

export type ByokStatus = 'active' | 'invalid'

export interface ByokRecord {
  pk: string
  sk: string
  userId: string
  provider: string
  ciphertext: string
  last4: string
  validatedAt: string
  status: ByokStatus
  gsi1pk: string
  gsi1sk: string
}

export interface ByokKeyData {
  apiKey: string
  last4: string
  status: ByokStatus
  validatedAt: string
}

/**
 * Encrypts and stores a user's API key for the given provider.
 * The `gsi1pk`/`gsi1sk` attributes are required for the ByokHolders GSI —
 * omitting them would make the row invisible to `listKeyHolders`.
 */
export async function putByokKey(params: {
  userId: string
  provider: string
  apiKey: string
}): Promise<void> {
  const { userId, provider, apiKey } = params
  const ciphertext = await encryptSecret(apiKey)
  const last4 = apiKey.slice(-4)
  const validatedAt = new Date().toISOString()

  const item: ByokRecord = {
    ...byokKey(userId, provider),
    userId,
    provider,
    ciphertext,
    last4,
    validatedAt,
    status: 'active',
    gsi1pk: `BYOK#${provider}`,
    gsi1sk: `USER#${userId}`,
  }

  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )
}

/**
 * Retrieves and decrypts the user's stored API key for the given provider.
 * Returns null if no key is stored.
 */
export async function getByokKey(userId: string, provider: string): Promise<ByokKeyData | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: byokKey(userId, provider),
    }),
  )

  if (!Item) return null

  const record = Item as ByokRecord
  const apiKey = await decryptSecret(record.ciphertext)

  return {
    apiKey,
    last4: record.last4,
    status: record.status,
    validatedAt: record.validatedAt,
  }
}

/**
 * Removes the user's stored API key for the given provider.
 */
export async function deleteByokKey(userId: string, provider: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TableNames.userData,
      Key: byokKey(userId, provider),
    }),
  )
}

/**
 * Returns true if the user has a stored API key for the given provider.
 * Uses a projected GetItem (no decryption).
 */
export async function hasByokKey(userId: string, provider: string): Promise<boolean> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: byokKey(userId, provider),
      ProjectionExpression: 'pk',
    }),
  )
  return Item !== undefined
}

export interface ByokKeyStatus {
  last4: string
  validatedAt: string
  status: ByokStatus
}

/**
 * Returns the non-secret metadata for a stored API key without decrypting it.
 * Uses a projected GetItem so the ciphertext is never fetched from DynamoDB
 * and no KMS call is made — safe for display in the Account UI.
 * Returns null if no key is stored for the given user/provider.
 */
export async function getByokKeyStatus(
  userId: string,
  provider: string,
): Promise<ByokKeyStatus | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: byokKey(userId, provider),
      ProjectionExpression: 'last4, validatedAt, #s',
      ExpressionAttributeNames: { '#s': 'status' },
    }),
  )
  if (!Item) return null
  return { last4: Item.last4, validatedAt: Item.validatedAt, status: Item.status }
}

/**
 * Queries the ByokHolders GSI to enumerate all users holding a key for the
 * given provider. Returns userId + status pairs.
 * Used by Phase 6 jobs to fan out ingestion across key holders.
 */
export async function listKeyHolders(
  provider: string,
): Promise<Array<{ userId: string; status: ByokStatus }>> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      IndexName: 'ByokHolders',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `BYOK#${provider}`,
      },
    }),
  )

  return (Items as ByokRecord[]).map((item) => ({
    userId: item.userId,
    status: item.status,
  }))
}
