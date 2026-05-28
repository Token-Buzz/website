import { createHash } from 'node:crypto'
import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
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

/** SavedQuery without the large `snapshot` blob — used for list views. */
export type SavedQueryListItem = Omit<SavedQuery, 'snapshot'>

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

/**
 * List all saved queries for a user, newest-first, WITHOUT the large snapshot
 * blob (projected out for efficiency).
 */
export async function listSavedQueries(userId: string): Promise<SavedQueryListItem[]> {
  const items: SavedQueryListItem[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new QueryCommand({
        TableName: TableNames.userData,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':p': 'QUERY#',
        },
        // Exclude the large snapshot blob; ttl and query are reserved words so alias them.
        ProjectionExpression: 'userId, submittedAt, queryHash, #query, createdAt, #ttl',
        ExpressionAttributeNames: {
          '#ttl': 'ttl',
          '#query': 'query',
        },
        ExclusiveStartKey: lastKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue> | undefined,
      }),
    )
    for (const item of Items) {
      items.push(item as SavedQueryListItem)
    }
    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey !== undefined)

  // Sort newest-first by submittedAt (ISO strings compare lexicographically).
  return items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
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
