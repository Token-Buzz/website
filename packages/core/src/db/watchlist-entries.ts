/**
 * CRUD + reorder operations for WatchlistEntry rows in the UserData table.
 *
 * Row shape:
 *   pk  = USER#<userId>
 *   sk  = WATCH#<entryId>
 *
 * The `WATCH#` prefix is distinct from the legacy `WATCHLIST#` prefix used by
 * the older Watchlist/WatchlistItem types — no collision is possible.
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { watchlistEntryKey } from './keys'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WatchlistEntry {
  pk: string
  sk: string
  userId: string
  entryId: string
  /** Uppercased ticker symbol, e.g. "PEPE". */
  symbol: string
  /** Search query string used to ingest content for this entry. */
  query: string
  /** Display order: lower number appears higher in the list. */
  order: number
  addedAt: string
  updatedAt: string
}

export interface CreateWatchlistEntryInput {
  userId: string
  symbol: string
  query: string
  order?: number
}

export interface UpdateWatchlistEntryPatch {
  symbol?: string
  query?: string
  order?: number
}

// ── ID generator ──────────────────────────────────────────────────────────────

function randomBase36(len: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function generateEntryId(): string {
  return `we_${Date.now().toString(36)}_${randomBase36(6)}`
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listWatchlistEntries(userId: string): Promise<WatchlistEntry[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'WATCH#',
      },
    }),
  )
  const entries = Items as WatchlistEntry[]
  // Sort by order asc, then addedAt asc as tiebreak.
  return entries.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.addedAt.localeCompare(b.addedAt)
  })
}

export async function createWatchlistEntry(
  input: CreateWatchlistEntryInput,
): Promise<WatchlistEntry> {
  const { userId, symbol, query } = input
  const entryId = generateEntryId()
  const now = new Date().toISOString()

  let order: number
  if (input.order !== undefined) {
    order = input.order
  } else {
    const existing = await listWatchlistEntries(userId)
    order = existing.length === 0 ? 0 : Math.max(...existing.map((e) => e.order)) + 1
  }

  const item: WatchlistEntry = {
    ...watchlistEntryKey(userId, entryId),
    userId,
    entryId,
    symbol: symbol.toUpperCase(),
    query,
    order,
    addedAt: now,
    updatedAt: now,
  }

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))
  return item
}

export async function getWatchlistEntry(
  userId: string,
  entryId: string,
): Promise<WatchlistEntry | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: watchlistEntryKey(userId, entryId),
    }),
  )
  return Item ? (Item as WatchlistEntry) : null
}

export async function updateWatchlistEntry(
  userId: string,
  entryId: string,
  patch: UpdateWatchlistEntryPatch,
): Promise<WatchlistEntry | null> {
  const existing = await getWatchlistEntry(userId, entryId)
  if (!existing) return null

  const updated: WatchlistEntry = { ...existing }

  if (patch.symbol !== undefined) updated.symbol = patch.symbol.toUpperCase()
  if (patch.query !== undefined) updated.query = patch.query
  if (patch.order !== undefined) updated.order = patch.order

  updated.updatedAt = new Date().toISOString()

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: updated }))
  return updated
}

export async function deleteWatchlistEntry(userId: string, entryId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TableNames.userData,
      Key: watchlistEntryKey(userId, entryId),
    }),
  )
}

/**
 * Assigns sequential order values (0..N-1) to the given entry IDs.
 * IDs not belonging to this user are silently ignored.
 * Entries not in the provided list are left untouched.
 */
export async function reorderWatchlistEntries(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((entryId, index) =>
      updateWatchlistEntry(userId, entryId, { order: index }),
    ),
  )
}
