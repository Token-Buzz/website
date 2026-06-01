import { createHash } from 'node:crypto'
import { PutCommand, GetCommand, QueryCommand, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
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

/**
 * Delete all SavedQuery rows whose stored `ttl` is <= `now` (epoch seconds).
 *
 * Deletion is based on the TTL value that was baked into each row at write
 * time — NOT on the user's current plan. This is deliberate: a user who
 * downgrades should not have historical rows retroactively removed on a
 * subsequent sweep; only rows that were already past their stored expiry are
 * collected.
 *
 * Alpha-tier rows (written without a `ttl` attribute) are never touched
 * because the FilterExpression requires `attribute_exists(#ttl)`.
 */
export async function sweepExpiredSavedQueries(
  opts: { now?: number } = {},
): Promise<{ deleted: number }> {
  const now = opts.now ?? Math.floor(Date.now() / 1000)

  // Collect all expired QUERY# rows across all users via a full-table scan.
  const expiredKeys: Array<{ pk: string; sk: string }> = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new ScanCommand({
        TableName: TableNames.userData,
        FilterExpression: 'begins_with(sk, :q) AND attribute_exists(#ttl) AND #ttl <= :now',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':q': 'QUERY#', ':now': now },
        ProjectionExpression: 'pk, sk',
        ExclusiveStartKey: lastKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue> | undefined,
      }),
    )
    for (const item of Items) {
      expiredKeys.push({ pk: item.pk as string, sk: item.sk as string })
    }
    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey !== undefined)

  if (expiredKeys.length === 0) {
    return { deleted: 0 }
  }

  // Delete in chunks of 25 (DynamoDB BatchWrite limit).
  const CHUNK_SIZE = 25
  const MAX_RETRIES = 5
  let deleted = 0

  for (let i = 0; i < expiredKeys.length; i += CHUNK_SIZE) {
    const chunk = expiredKeys.slice(i, i + CHUNK_SIZE)
    let unprocessed = chunk.map((key) => ({ DeleteRequest: { Key: key } }))

    for (let attempt = 0; attempt < MAX_RETRIES && unprocessed.length > 0; attempt++) {
      const { UnprocessedItems = {} } = await ddb.send(
        new BatchWriteCommand({
          RequestItems: { [TableNames.userData]: unprocessed },
        }),
      )
      const remaining = UnprocessedItems[TableNames.userData] ?? []
      deleted += unprocessed.length - remaining.length
      unprocessed = remaining as typeof unprocessed
    }
  }

  return { deleted }
}

/**
 * True when the user already has a saved query whose text hashes to the same
 * `queryHash` — i.e. they have run this exact query before. Used to classify a
 * /api/query submission as a refresh (re-run) vs a new ingestion.
 */
export async function userHasQuery(userId: string, query: string): Promise<boolean> {
  const hash = hashQuery(query)
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
        ProjectionExpression: 'queryHash',
        ExclusiveStartKey: lastKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue> | undefined,
      }),
    )
    for (const item of Items) {
      if ((item as { queryHash: string }).queryHash === hash) return true
    }
    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey !== undefined)

  return false
}
