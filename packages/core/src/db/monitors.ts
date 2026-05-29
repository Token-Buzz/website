import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { monitorKey, monitorSkPrefix, monitorGsi, MONITOR_GSI_PK } from './keys'
import { isSocialSource, type SocialSource } from '../sources/types'

export interface Monitor {
  userId: string
  query: string
  sources: SocialSource[]
  /** Requested polling cadence in ms (the poller still bounds this by each source's floor). */
  intervalMs: number
  createdAt: string
  updatedAt: string
}

/**
 * Upserts a Monitor record for the given user+query.
 * Normalizes: trims query, filters sources to valid SocialSource values only.
 */
export async function putMonitor(monitor: Monitor): Promise<void> {
  const normalized: Monitor = {
    ...monitor,
    query: monitor.query.trim(),
    sources: monitor.sources.filter(isSocialSource),
  }

  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: {
        ...monitorKey(normalized.userId, normalized.query),
        ...monitorGsi(normalized.userId, normalized.query),
        ...normalized,
      },
    }),
  )
}

/**
 * Returns the Monitor for the given user+query, or null if not found.
 */
export async function getMonitor(userId: string, query: string): Promise<Monitor | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: monitorKey(userId, query),
    }),
  )
  if (!Item) return null
  return {
    userId: Item.userId,
    query: Item.query,
    sources: (Item.sources as SocialSource[] | undefined) ?? [],
    intervalMs: (Item.intervalMs as number | undefined) ?? 0,
    createdAt: Item.createdAt,
    updatedAt: Item.updatedAt,
  }
}

/**
 * Lists all Monitor records for the given user.
 */
export async function listMonitors(userId: string): Promise<Monitor[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': monitorSkPrefix,
      },
    }),
  )
  return Items.map((item) => ({
    userId: item.userId as string,
    query: item.query as string,
    sources: (item.sources as SocialSource[] | undefined) ?? [],
    intervalMs: (item.intervalMs as number | undefined) ?? 0,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
  }))
}

/**
 * Deletes the Monitor record for the given user+query.
 */
export async function deleteMonitor(userId: string, query: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TableNames.userData,
      Key: monitorKey(userId, query),
    }),
  )
}

/**
 * Enumerate ALL monitors across all users via the ByokHolders GSI
 * (gsi1pk = MONITOR_GSI_PK). Paginates until exhausted so large result sets
 * are never truncated.
 */
export async function listAllMonitors(): Promise<Monitor[]> {
  const results: Monitor[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new QueryCommand({
        TableName: TableNames.userData,
        IndexName: 'ByokHolders',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': MONITOR_GSI_PK,
        },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }),
    )

    for (const item of Items) {
      results.push({
        userId: item.userId as string,
        query: item.query as string,
        sources: (item.sources as SocialSource[] | undefined) ?? [],
        intervalMs: (item.intervalMs as number | undefined) ?? 0,
        createdAt: item.createdAt as string,
        updatedAt: item.updatedAt as string,
      })
    }

    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey)

  return results
}
