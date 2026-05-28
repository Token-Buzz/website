/**
 * Account-level data operations: export and full deletion of all a user's rows
 * in the UserData table.
 *
 * All rows for a user live under pk = USER#<userId>. A single paginated Query
 * is sufficient to enumerate them all. BYOK rows contain a `ciphertext` field
 * (the KMS-encrypted API key material) — this is redacted in the export so the
 * downloaded JSON never contains sensitive key material.
 */

import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'

// ── Sensitive attribute names to redact from BYOK rows ────────────────────────

/**
 * Attribute names that carry encrypted key material on BYOK rows.
 * These are replaced with "[redacted]" in the export.
 */
const REDACTED_ATTRS = ['ciphertext'] as const

// ── exportUserData ─────────────────────────────────────────────────────────────

/**
 * Returns all DynamoDB items for the user (paginated), with sensitive BYOK
 * fields replaced by "[redacted]". Safe to deliver to the end user as JSON.
 */
export async function exportUserData(
  userId: string,
): Promise<Record<string, unknown>[]> {
  const pk = `USER#${userId}`
  const items: Record<string, unknown>[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new QueryCommand({
        TableName: TableNames.userData,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }),
    )
    for (const item of Items as Record<string, unknown>[]) {
      items.push(redactItem(item))
    }
    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey !== undefined)

  return items
}

// ── deleteAllUserData ──────────────────────────────────────────────────────────

/**
 * Deletes every DynamoDB item for the user (pk = USER#<userId>), paginating
 * through the table and issuing BatchWriteCommand in chunks of 25.
 * Retries UnprocessedItems up to 3 times with a short back-off.
 * Returns the total number of items deleted.
 */
export async function deleteAllUserData(userId: string): Promise<number> {
  const pk = `USER#${userId}`

  // Collect all keys first so we can batch-delete in chunks.
  const keys: { pk: string; sk: string }[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(
      new QueryCommand({
        TableName: TableNames.userData,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ProjectionExpression: 'pk, sk',
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }),
    )
    for (const item of Items as { pk: string; sk: string }[]) {
      keys.push({ pk: item.pk, sk: item.sk })
    }
    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey !== undefined)

  // DynamoDB BatchWrite is capped at 25 requests per call.
  const CHUNK = 25
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK)
    let requestItems = chunk.map((k) => ({
      DeleteRequest: { Key: k },
    }))

    // Retry unprocessed items a few times.
    for (let attempt = 0; attempt < 3 && requestItems.length > 0; attempt++) {
      const { UnprocessedItems } = await ddb.send(
        new BatchWriteCommand({
          RequestItems: { [TableNames.userData]: requestItems },
        }),
      )
      requestItems =
        (UnprocessedItems?.[TableNames.userData] as typeof requestItems) ?? []
      if (requestItems.length > 0 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
  }

  return keys.length
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function redactItem(item: Record<string, unknown>): Record<string, unknown> {
  const result = { ...item }
  for (const attr of REDACTED_ATTRS) {
    if (attr in result) {
      result[attr] = '[redacted]'
    }
  }
  return result
}
