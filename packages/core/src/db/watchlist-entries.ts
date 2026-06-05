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
import { watchlistBySymbolGsi, watchlistEntryKey } from './keys'

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
  /** Whether per-token press alerts are enabled for this entry (M13 Phase 4). */
  pressAlerts?: boolean
  /** Whether per-token news alerts are enabled for this entry (M14 Phase 4). */
  newsAlerts?: boolean
  /** User-submitted newsroom override (M13 Phase 5); read precedence user → global PROFILE. */
  pressUrlOverride?: string
  /** User-submitted feed override (M13 Phase 5); read precedence user → global PROFILE. */
  pressFeedUrlOverride?: string
  /** WatchersBySymbol GSI key — present only when pressAlerts or newsAlerts is true. */
  gsi1pk?: string
  /** WatchersBySymbol GSI key — present only when pressAlerts or newsAlerts is true. */
  gsi1sk?: string
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

  // Maintain the WatchersBySymbol GSI invariant. The `{...existing}` spread above
  // would otherwise carry stale gsi keys when the symbol changes.
  // The GSI must be present when EITHER pressAlerts OR newsAlerts is true.
  if (updated.pressAlerts === true || updated.newsAlerts === true) {
    const gsi = watchlistBySymbolGsi(updated.symbol, userId)
    updated.gsi1pk = gsi.gsi1pk
    updated.gsi1sk = gsi.gsi1sk
  } else {
    delete updated.gsi1pk
    delete updated.gsi1sk
  }

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: updated }))
  return updated
}

/**
 * Toggles per-token press and/or news alerts for a watchlist entry. When either
 * pressAlerts or newsAlerts is enabled, the row joins the WatchersBySymbol
 * partition on the ByokHolders GSI (gsi1pk/gsi1sk); when both are disabled, the
 * full PutCommand replaces the item without those attributes, dropping it out of
 * the GSI. Only the provided fields are modified; omitting a field leaves it
 * unchanged. Returns null if the entry does not exist.
 */
export async function setWatchlistAlertPrefs(
  userId: string,
  entryId: string,
  prefs: { pressAlerts?: boolean; newsAlerts?: boolean },
): Promise<WatchlistEntry | null> {
  const existing = await getWatchlistEntry(userId, entryId)
  if (!existing) return null

  const updated: WatchlistEntry = { ...existing }

  // Apply only the provided fields; omitted fields remain unchanged.
  if (prefs.pressAlerts !== undefined) updated.pressAlerts = prefs.pressAlerts
  if (prefs.newsAlerts !== undefined) updated.newsAlerts = prefs.newsAlerts

  updated.updatedAt = new Date().toISOString()

  // The GSI must be present when EITHER pressAlerts OR newsAlerts is true.
  const wantsGsi = updated.pressAlerts === true || updated.newsAlerts === true
  if (wantsGsi) {
    const gsi = watchlistBySymbolGsi(updated.symbol, userId)
    updated.gsi1pk = gsi.gsi1pk
    updated.gsi1sk = gsi.gsi1sk
  } else {
    delete updated.gsi1pk
    delete updated.gsi1sk
  }

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: updated }))
  return updated
}

/**
 * Sets (or clears) the per-user press link overrides on a watchlist entry.
 * Passing a field as undefined leaves it unchanged; passing null (or an empty
 * string) clears it. Returns null if the entry does not exist.
 *
 * This function does NOT disturb the WatchersBySymbol GSI keys — the
 * `{...existing}` spread preserves gsi1pk/gsi1sk exactly as they are on the
 * existing row, so an entry that appears in listWatchersForSymbol stays there.
 */
export async function setWatchlistLinkOverrides(
  userId: string,
  entryId: string,
  overrides: { pressUrlOverride?: string | null; pressFeedUrlOverride?: string | null },
): Promise<WatchlistEntry | null> {
  const existing = await getWatchlistEntry(userId, entryId)
  if (!existing) return null

  const updated: WatchlistEntry = { ...existing }

  if (overrides.pressUrlOverride !== undefined) {
    if (overrides.pressUrlOverride) updated.pressUrlOverride = overrides.pressUrlOverride
    else delete updated.pressUrlOverride
  }
  if (overrides.pressFeedUrlOverride !== undefined) {
    if (overrides.pressFeedUrlOverride) updated.pressFeedUrlOverride = overrides.pressFeedUrlOverride
    else delete updated.pressFeedUrlOverride
  }

  updated.updatedAt = new Date().toISOString()

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: updated }))
  return updated
}

/**
 * Returns the watchlist entries that have opted into press OR news alerts for a
 * given symbol, via the WatchersBySymbol partition on the ByokHolders GSI.
 * Only entries with gsi1pk/gsi1sk carry those keys (written when pressAlerts or
 * newsAlerts is true), so this returns the union of both alert types.
 * Callers that want kind-specific delivery MUST filter the result by the
 * relevant field (e.g. `e.pressAlerts === true` or `e.newsAlerts === true`).
 */
export async function listWatchersForSymbol(symbol: string): Promise<WatchlistEntry[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      IndexName: 'ByokHolders',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `WATCHSYM#${symbol.toUpperCase()}`,
      },
    }),
  )
  return Items as WatchlistEntry[]
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
