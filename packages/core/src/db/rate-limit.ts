import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { rateLimitKey } from './keys'

export const GECKOTERMINAL_LIMIT = 25 // threshold out of 30/min free tier
export const JUPITER_LIMIT = 60 // Jupiter is more permissive

export interface RateLimitResult {
  allowed: boolean
  count: number
  retryAfterSec: number
}

// Returns seconds until the next minute boundary.
export function retryAfterSeconds(nowMs: number = Date.now()): number {
  return 60 - Math.floor((nowMs / 1000) % 60)
}

// Atomically increments the per-minute call counter for the given provider.
// Returns { allowed, count, retryAfterSec }.
// Stores the counter in the Aggregates table with a 90-second TTL.
export async function checkAndIncrement(
  provider: string,
  limitPerMin: number,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const nowSec = Math.floor(nowMs / 1000)
  // Minute-bucket string: "YYYY-MM-DDTHH:MM" (first 16 chars of ISO string)
  const minuteStr = new Date(nowMs).toISOString().slice(0, 16)
  const key = rateLimitKey(provider, minuteStr)
  const ttl = nowSec + 90 // auto-expire after 90s

  const res = await ddb.send(
    new UpdateCommand({
      TableName: TableNames.aggregates,
      Key: key,
      UpdateExpression: 'ADD #count :inc SET #ttl = :ttl',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':inc': 1, ':ttl': ttl },
      ReturnValues: 'UPDATED_NEW',
    }),
  )

  const count = (res.Attributes?.count as number | undefined) ?? 1
  const allowed = count <= limitPerMin
  return { allowed, count, retryAfterSec: retryAfterSeconds(nowMs) }
}
