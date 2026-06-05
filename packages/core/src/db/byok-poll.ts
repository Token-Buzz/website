import { listKeyHolders, getByokKey } from './byok'
import { getAllTrackedQueries } from './user-data'
import { assignQueriesToHolders, type PollHolder } from '../lib/poll-assignment'

export interface PollAssignment {
  userId: string
  apiKey: string // decrypted — server/job use only, never returned to clients
  queries: string[]
}

/**
 * Builds the set of (key-holder, decrypted key, deduped queries) to poll this
 * cycle for a provider. Only active, opted-in holders participate; a query
 * tracked by several holders is assigned to just one. Holders whose key fails
 * to decrypt or is no longer active are skipped.
 */
export async function getPollAssignments(provider: string): Promise<PollAssignment[]> {
  const holders = await listKeyHolders(provider)
  const eligible = holders.filter((h) => h.status === 'active' && h.backgroundPolling)

  const withQueries: PollHolder[] = []
  for (const h of eligible) {
    const queries = await getAllTrackedQueries(h.userId)
    if (queries.length > 0) withQueries.push({ userId: h.userId, queries })
  }

  const assigned = assignQueriesToHolders(withQueries) // Map<userId, string[]>

  const result: PollAssignment[] = []
  for (const [userId, queries] of assigned) {
    const key = await getByokKey(userId, provider) // decrypt
    if (key && key.status === 'active') {
      result.push({ userId, apiKey: key.apiKey, queries })
    }
  }
  return result
}

/**
 * Resolves a single active API key for a news firehose provider (e.g. 'newsdata',
 * 'cryptocompare'). News APIs are pulled ONCE per cycle as a shared firehose —
 * the same response is relevant to all tracked tokens regardless of which user
 * owns the key. Because of this, we don't use `getPollAssignments` (which filters
 * to holders with tracked queries); instead we pick the FIRST active, opted-in
 * key holder whose key decrypts successfully. One user's free-tier quota is
 * sufficient to fetch the non-user-scoped feed on behalf of everyone.
 *
 * Returns `{ userId, apiKey }` for the first usable holder, or `null` if none.
 */
export async function getNewsFirehoseKey(
  provider: string,
): Promise<{ userId: string; apiKey: string } | null> {
  const holders = await listKeyHolders(provider)
  const eligible = holders.filter((h) => h.status === 'active' && h.backgroundPolling)

  for (const h of eligible) {
    const key = await getByokKey(h.userId, provider)
    if (key && key.status === 'active') {
      return { userId: h.userId, apiKey: key.apiKey }
    }
  }

  return null
}
