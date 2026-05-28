import { createHash } from 'node:crypto'
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { savedQueryKey } from './keys'

export interface SavedQuery {
  userId: string
  /** ISO-8601 submission timestamp; part of the sort key. */
  submittedAt: string
  queryHash: string
  query: string
  /** Opaque aggregate blob the analytics cards rendered (SummaryData shape). */
  snapshot: unknown
  createdAt: string
  /** Epoch-seconds DynamoDB TTL; absent = no expiry. */
  ttl?: number
}

/** Short, stable hash of the query string for a bounded sort key. */
export function hashQuery(query: string): string {
  return createHash('sha256').update(query).digest('hex').slice(0, 16)
}

export async function createSavedQuery(params: {
  userId: string
  query: string
  snapshot: unknown
  ttl?: number
}): Promise<SavedQuery> {
  const submittedAt = new Date().toISOString()
  const queryHash = hashQuery(params.query)
  const item: SavedQuery = {
    ...savedQueryKey(params.userId, submittedAt, queryHash),
    userId: params.userId,
    submittedAt,
    queryHash,
    query: params.query,
    snapshot: params.snapshot,
    createdAt: submittedAt,
    ...(params.ttl !== undefined && { ttl: params.ttl }),
  }
  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))
  return item
}

export async function getSavedQuery(
  userId: string,
  submittedAt: string,
  queryHash: string,
): Promise<SavedQuery | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: savedQueryKey(userId, submittedAt, queryHash),
    }),
  )
  return (Item as SavedQuery) ?? null
}
