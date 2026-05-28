import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { sourceCountKey, sourceCountPk } from './keys'

/**
 * Increment the ingestion count for a given (query, source) pair by `n`.
 *
 * Uses an atomic ADD so concurrent calls accumulate correctly.
 * Mirrors the pattern used in `recordIngestionUsage` in usage.ts.
 */
export async function incrementSourceCount(
  query: string,
  source: string,
  n: number = 1,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TableNames.aggregates,
      Key: sourceCountKey(query, source),
      UpdateExpression: 'ADD #count :n SET updatedAt = :now',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: {
        ':n': n,
        ':now': new Date().toISOString(),
      },
    }),
  )
}

/**
 * Read all per-source ingestion counts for a query.
 *
 * Returns a map of { [source]: count }. An unrecognised query returns `{}`.
 */
export async function readSourceCounts(query: string): Promise<Record<string, number>> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.aggregates,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': sourceCountPk(query) },
    }),
  )

  const result: Record<string, number> = {}
  for (const item of Items) {
    // sk format: SRC#<source>
    const sk = item.sk as string
    if (sk.startsWith('SRC#')) {
      const source = sk.slice(4)
      result[source] = (item.count as number) ?? 0
    }
  }
  return result
}
