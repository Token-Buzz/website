/**
 * WatchlistEntry integration test — exercises the real
 * `packages/core/src/db/watchlist-entries.ts` functions
 * (createWatchlistEntry, listWatchlistEntries, getWatchlistEntry,
 * updateWatchlistEntry, deleteWatchlistEntry, reorderWatchlistEntries)
 * and the `getAllTrackedQueries` function in `packages/core/src/db/user-data.ts`
 * against a local dynalite DynamoDB. No mocking of ddb — every test is a real
 * write→read round-trip.
 */

import { beforeEach, describe, expect, test } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import {
  createWatchlistEntry,
  listWatchlistEntries,
  getWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistEntry,
  reorderWatchlistEntries,
} from '@monorepo-template/core/db/watchlist-entries'
import { getAllTrackedQueries } from '@monorepo-template/core/db/user-data'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENDPOINT = 'http://127.0.0.1:8000'
const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearUserData() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.userData,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.userData,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await clearUserData()
})

// ── createWatchlistEntry / listWatchlistEntries ───────────────────────────────

describe('createWatchlistEntry / listWatchlistEntries', () => {
  const USER_ID = 'user_watch_test_123'

  test('creates an entry with correct pk/sk, uppercased symbol, and timestamps', async () => {
    const before = new Date().toISOString()
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'pepe',
      query: '$PEPE OR #PEPE',
    })
    const after = new Date().toISOString()

    expect(entry.pk).toBe(`USER#${USER_ID}`)
    expect(entry.sk).toMatch(/^WATCH#we_/)
    expect(entry.userId).toBe(USER_ID)
    expect(entry.entryId).toMatch(/^we_/)
    expect(entry.symbol).toBe('PEPE')
    expect(entry.query).toBe('$PEPE OR #PEPE')
    expect(entry.order).toBe(0)
    expect(entry.addedAt >= before).toBe(true)
    expect(entry.addedAt <= after).toBe(true)
    expect(entry.updatedAt).toBe(entry.addedAt)
  })

  test('listWatchlistEntries returns the created entry', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'BTC',
      query: '$BTC OR #BTC',
    })

    const entries = await listWatchlistEntries(USER_ID)
    expect(entries).toHaveLength(1)
    expect(entries[0].entryId).toBe(created.entryId)
    expect(entries[0].symbol).toBe('BTC')
  })

  test('listWatchlistEntries returns empty array when no entries exist', async () => {
    const entries = await listWatchlistEntries('user_with_no_entries')
    expect(entries).toHaveLength(0)
  })

  test('second entry gets order=1 (auto-increment from max)', async () => {
    await createWatchlistEntry({ userId: USER_ID, symbol: 'BTC', query: '$BTC OR #BTC' })
    const second = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'ETH',
      query: '$ETH OR #ETH',
    })
    expect(second.order).toBe(1)
  })

  test('listWatchlistEntries returns entries sorted by order asc, then addedAt asc as tiebreak', async () => {
    const e1 = await createWatchlistEntry({ userId: USER_ID, symbol: 'AAA', query: '$AAA', order: 2 })
    const e2 = await createWatchlistEntry({ userId: USER_ID, symbol: 'BBB', query: '$BBB', order: 0 })
    const e3 = await createWatchlistEntry({ userId: USER_ID, symbol: 'CCC', query: '$CCC', order: 1 })

    const entries = await listWatchlistEntries(USER_ID)
    expect(entries).toHaveLength(3)
    expect(entries[0].entryId).toBe(e2.entryId) // order 0
    expect(entries[1].entryId).toBe(e3.entryId) // order 1
    expect(entries[2].entryId).toBe(e1.entryId) // order 2
  })

  test('is user-scoped — does not return another user\'s entries', async () => {
    await createWatchlistEntry({ userId: USER_ID, symbol: 'BTC', query: '$BTC' })
    await createWatchlistEntry({ userId: 'other_user_abc', symbol: 'ETH', query: '$ETH' })

    const entries = await listWatchlistEntries(USER_ID)
    expect(entries).toHaveLength(1)
    expect(entries[0].symbol).toBe('BTC')
  })
})

// ── getWatchlistEntry ─────────────────────────────────────────────────────────

describe('getWatchlistEntry', () => {
  const USER_ID = 'user_watch_get_test'

  test('returns the entry after creation', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'SOL',
      query: '$SOL OR #SOL',
    })

    const fetched = await getWatchlistEntry(USER_ID, created.entryId)
    expect(fetched).not.toBeNull()
    expect(fetched!.entryId).toBe(created.entryId)
    expect(fetched!.symbol).toBe('SOL')
  })

  test('returns null for a non-existent entryId', async () => {
    const result = await getWatchlistEntry(USER_ID, 'we_nonexistent_00')
    expect(result).toBeNull()
  })

  test('returns null when the entryId belongs to a different user', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'ADA',
      query: '$ADA OR #ADA',
    })

    const result = await getWatchlistEntry('other_user_xyz', created.entryId)
    expect(result).toBeNull()
  })
})

// ── updateWatchlistEntry ──────────────────────────────────────────────────────

describe('updateWatchlistEntry', () => {
  const USER_ID = 'user_watch_update_test'

  test('symbol patch uppercases the new value', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'BTC',
      query: '$BTC OR #BTC',
    })

    await new Promise((r) => setTimeout(r, 2))
    const updated = await updateWatchlistEntry(USER_ID, created.entryId, {
      symbol: 'eth',
    })

    expect(updated).not.toBeNull()
    expect(updated!.symbol).toBe('ETH')
    // query must be preserved
    expect(updated!.query).toBe('$BTC OR #BTC')
    // updatedAt must have advanced past addedAt
    expect(updated!.updatedAt > created.addedAt).toBe(true)
  })

  test('query patch updates only the query field', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'DOGE',
      query: '$DOGE',
    })

    const updated = await updateWatchlistEntry(USER_ID, created.entryId, {
      query: '$DOGE OR #DOGE OR dogecoin',
    })

    expect(updated).not.toBeNull()
    expect(updated!.query).toBe('$DOGE OR #DOGE OR dogecoin')
    expect(updated!.symbol).toBe('DOGE')
  })

  test('order patch updates the order field', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'LINK',
      query: '$LINK OR #LINK',
    })

    const updated = await updateWatchlistEntry(USER_ID, created.entryId, { order: 5 })
    expect(updated!.order).toBe(5)
  })

  test('updated item is persisted — getWatchlistEntry reflects the change', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'AVAX',
      query: '$AVAX',
    })

    await updateWatchlistEntry(USER_ID, created.entryId, { query: '$AVAX OR #AVAX' })

    const fetched = await getWatchlistEntry(USER_ID, created.entryId)
    expect(fetched!.query).toBe('$AVAX OR #AVAX')
  })

  test('returns null when entryId does not exist', async () => {
    const result = await updateWatchlistEntry(USER_ID, 'we_nonexistent_99', { query: 'x' })
    expect(result).toBeNull()
  })
})

// ── deleteWatchlistEntry ──────────────────────────────────────────────────────

describe('deleteWatchlistEntry', () => {
  const USER_ID = 'user_watch_delete_test'

  test('delete removes the entry so getWatchlistEntry returns null', async () => {
    const created = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'DOT',
      query: '$DOT OR #DOT',
    })

    await deleteWatchlistEntry(USER_ID, created.entryId)

    const fetched = await getWatchlistEntry(USER_ID, created.entryId)
    expect(fetched).toBeNull()
  })

  test('delete removes only the targeted entry', async () => {
    const first = await createWatchlistEntry({ userId: USER_ID, symbol: 'BTC', query: '$BTC' })
    const second = await createWatchlistEntry({ userId: USER_ID, symbol: 'ETH', query: '$ETH' })

    await deleteWatchlistEntry(USER_ID, second.entryId)

    const remaining = await listWatchlistEntries(USER_ID)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].entryId).toBe(first.entryId)
  })

  test('delete on a non-existent entry does not throw', async () => {
    await expect(deleteWatchlistEntry(USER_ID, 'we_ghost_0000')).resolves.toBeUndefined()
  })
})

// ── reorderWatchlistEntries ───────────────────────────────────────────────────

describe('reorderWatchlistEntries', () => {
  const USER_ID = 'user_watch_reorder_test'

  test('assigns sequential order values 0..N-1 in the given id order', async () => {
    const e1 = await createWatchlistEntry({ userId: USER_ID, symbol: 'AAA', query: '$AAA' })
    const e2 = await createWatchlistEntry({ userId: USER_ID, symbol: 'BBB', query: '$BBB' })
    const e3 = await createWatchlistEntry({ userId: USER_ID, symbol: 'CCC', query: '$CCC' })

    // Reverse the order: CCC, AAA, BBB
    await reorderWatchlistEntries(USER_ID, [e3.entryId, e1.entryId, e2.entryId])

    const entries = await listWatchlistEntries(USER_ID)
    expect(entries).toHaveLength(3)
    expect(entries[0].symbol).toBe('CCC') // order=0
    expect(entries[1].symbol).toBe('AAA') // order=1
    expect(entries[2].symbol).toBe('BBB') // order=2
  })

  test('entries not in the provided list retain their existing order', async () => {
    const e1 = await createWatchlistEntry({ userId: USER_ID, symbol: 'BTC', query: '$BTC', order: 10 })
    const e2 = await createWatchlistEntry({ userId: USER_ID, symbol: 'ETH', query: '$ETH', order: 11 })
    const e3 = await createWatchlistEntry({ userId: USER_ID, symbol: 'SOL', query: '$SOL', order: 12 })

    // Only reorder e1 and e3; e2 is excluded.
    await reorderWatchlistEntries(USER_ID, [e3.entryId, e1.entryId])

    const after3 = await getWatchlistEntry(USER_ID, e3.entryId)
    const after1 = await getWatchlistEntry(USER_ID, e1.entryId)
    const after2 = await getWatchlistEntry(USER_ID, e2.entryId)

    expect(after3!.order).toBe(0)
    expect(after1!.order).toBe(1)
    // e2 was not included in the reorder list — its order is unchanged
    expect(after2!.order).toBe(e2.order)
  })
})

// ── getAllTrackedQueries includes WatchlistEntry queries ──────────────────────

describe('getAllTrackedQueries includes WatchlistEntry queries', () => {
  const USER_ID = 'user_watch_tracked_test'

  test('returns queries from WatchlistEntry rows', async () => {
    await createWatchlistEntry({ userId: USER_ID, symbol: 'PEPE', query: '$PEPE OR #PEPE' })
    await createWatchlistEntry({ userId: USER_ID, symbol: 'DOGE', query: '$DOGE OR #DOGE' })

    const queries = await getAllTrackedQueries(USER_ID)
    expect(queries).toContain('$PEPE OR #PEPE')
    expect(queries).toContain('$DOGE OR #DOGE')
  })

  test('deduplicates queries appearing in multiple entries', async () => {
    const SHARED_QUERY = '$BTC OR #BTC'
    await createWatchlistEntry({ userId: USER_ID, symbol: 'BTC', query: SHARED_QUERY })
    await createWatchlistEntry({ userId: USER_ID, symbol: 'BITCOIN', query: SHARED_QUERY })

    const queries = await getAllTrackedQueries(USER_ID)
    const count = queries.filter((q) => q === SHARED_QUERY).length
    expect(count).toBe(1)
  })

  test('returns empty array when no watchlist entries or legacy watchlists exist', async () => {
    const queries = await getAllTrackedQueries('user_with_nothing')
    expect(queries).toHaveLength(0)
  })
})
