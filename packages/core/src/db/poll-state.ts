import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { pollStateKey } from './keys'

const SEVEN_DAYS_S = 7 * 24 * 60 * 60

/**
 * Returns the epoch-ms timestamp of the last poll for the given source+query,
 * or null if it has never been polled.
 */
export async function getLastPolledAt(source: string, query: string): Promise<number | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.aggregates,
      Key: pollStateKey(source, query),
    }),
  )
  if (!Item || Item.lastPolledAt == null) return null
  return Item.lastPolledAt as number
}

/**
 * Records a successful poll for the given source+query.
 * Sets `lastPolledAt` to `atMs` (defaults to now) and a 7-day TTL so stale
 * rows self-clean (the Aggregates table has TTL enabled on the `ttl` attribute).
 */
export async function markPolled(
  source: string,
  query: string,
  atMs: number = Date.now(),
): Promise<void> {
  const ttl = Math.floor(atMs / 1000) + SEVEN_DAYS_S
  await ddb.send(
    new PutCommand({
      TableName: TableNames.aggregates,
      Item: {
        ...pollStateKey(source, query),
        lastPolledAt: atMs,
        ttl,
      },
    }),
  )
}

/**
 * Returns true if the given source+query should be polled now:
 * - true when never polled (no record exists), or
 * - true when at least `intervalMs` has elapsed since the last poll.
 */
export async function shouldPollNow(
  source: string,
  query: string,
  intervalMs: number,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const last = await getLastPolledAt(source, query)
  if (last === null) return true
  return nowMs - last >= intervalMs
}
