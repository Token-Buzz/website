import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import {
  tokenKey,
  tokenTrackedGsi,
  tokenSpikeWindowGsi,
  spikeIndexForWindow,
  spikePkForWindow,
} from './keys'

export interface TokenRecord {
  pk: string
  sk: string
  sym: string
  name: string
  price: number
  d24: number
  mentions: number
  /** Back-compat field — always equal to the 1H delta. */
  dbuzz: number
  dbuzz1h?: number
  dbuzz24h?: number
  dbuzz7d?: number
  sent: 'bull' | 'bear' | 'neu'
  spark: number[]
  live?: boolean
  summary?: string
  updatedAt: string
  gsi1pk?: string
  gsi1sk?: string
  gsi2pk?: string
  gsi2sk?: string
  gsi3pk?: string
  gsi3sk?: string
  gsi4pk?: string
  gsi4sk?: string
}

export interface FollowerSnapshot {
  pk: string
  sk: string
  handle: string
  date: string
  followers: number
}

export async function getToken(symbol: string): Promise<TokenRecord | null> {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TableNames.tokens,
    Key: { pk: `TOKEN#${symbol.toUpperCase()}`, sk: 'META' },
  }))
  return (Item as TokenRecord) ?? null
}

// Queries tracked tokens via the WatchlistByMentions GSI using the synthetic
// partition key 'TRACKED', which the spike-materializer populates (Phase 2).
export async function listTrackedTokens(opts: { limit?: number } = {}): Promise<TokenRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tokens,
    IndexName: 'WatchlistByMentions',
    KeyConditionExpression: 'gsi2pk = :pk',
    ExpressionAttributeValues: { ':pk': 'TRACKED' },
    ScanIndexForward: false,
    Limit: opts.limit ?? 100,
  }))
  return Items as TokenRecord[]
}

/**
 * Queries tokens ranked by buzz delta for the given time window.
 * Default window '1H' preserves backwards-compatibility for existing callers.
 */
export async function getSpikingTokens(
  opts: { window?: '1H' | '24H' | '7D'; limit?: number } = {},
): Promise<TokenRecord[]> {
  const window = opts.window ?? '1H'
  const pkAttr = pkAttrForWindow(window)
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tokens,
    IndexName: spikeIndexForWindow(window),
    KeyConditionExpression: '#gsiPk = :pk',
    ExpressionAttributeNames: { '#gsiPk': pkAttr },
    ExpressionAttributeValues: { ':pk': spikePkForWindow(window) },
    ScanIndexForward: false,
    Limit: opts.limit ?? 20,
  }))
  return Items as TokenRecord[]
}

// Helper: the actual hash-key attribute name for each window's GSI.
function pkAttrForWindow(window: '1H' | '24H' | '7D'): string {
  return { '1H': 'gsi1pk', '24H': 'gsi3pk', '7D': 'gsi4pk' }[window]
}

export async function getFollowerHistory(
  handle: string,
  days = 30,
): Promise<FollowerSnapshot[]> {
  const fromDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tokens,
    KeyConditionExpression: 'pk = :pk AND sk >= :from',
    ExpressionAttributeValues: {
      ':pk': `FOLLOWER#${handle.replace('@', '')}`,
      ':from': `SNAP#${fromDate}`,
    },
  }))
  return Items as FollowerSnapshot[]
}

export async function upsertToken(token: Omit<TokenRecord, 'pk' | 'sk'>): Promise<void> {
  const now = new Date().toISOString()
  const sym = token.sym.toUpperCase()
  const delta = token.dbuzz
  const mentions = token.mentions

  await ddb.send(new PutCommand({
    TableName: TableNames.tokens,
    Item: {
      pk: `TOKEN#${sym}`,
      sk: 'META',
      ...token,
      sym,
      updatedAt: now,
      gsi1pk: delta > 0 ? 'SPIKE' : undefined,
      gsi1sk: delta > 0 ? `${delta.toString().padStart(10, '0')}#${sym}` : undefined,
      gsi2pk: 'TRACKED',
      gsi2sk: `${mentions.toString().padStart(10, '0')}#${sym}`,
    },
  }))
}

/**
 * Updates only the buzz fields on a token's META row, refreshing the
 * SpikingByDelta* GSIs (gsi1/gsi3/gsi4) and WatchlistByMentions GSI (gsi2).
 *
 * Uses a single UpdateCommand so it never clobbers price/name/spark set
 * elsewhere. For each window independently: a positive delta sets that window's
 * GSI keys; a non-positive delta removes them. gsi2 (TRACKED) is always set.
 *
 * `dbuzz` (back-compat) is always set to the 1H delta.
 */
export async function updateTokenBuzz(data: {
  symbol: string
  mentions: number
  deltas: Record<'1H' | '24H' | '7D', number>
}): Promise<void> {
  const sym = data.symbol.toUpperCase()
  const now = new Date().toISOString()
  const tracked = tokenTrackedGsi(data.mentions, sym)

  const d1h = data.deltas['1H']
  const d24h = data.deltas['24H']
  const d7d = data.deltas['7D']

  // Build SET and REMOVE clauses dynamically so we never produce an empty clause
  // or both SET and REMOVE the same attribute.

  // Always-set base expressions.
  const setExprParts: string[] = [
    'dbuzz = :d1h',
    'dbuzz1h = :d1h',
    'dbuzz24h = :d24h',
    'dbuzz7d = :d7d',
    'mentions = :m',
    'updatedAt = :u',
    'sym = if_not_exists(sym, :sym)',
    'gsi2pk = :g2p',
    'gsi2sk = :g2s',
  ]
  const removeExprParts: string[] = []

  const values: Record<string, unknown> = {
    ':d1h': d1h,
    ':d24h': d24h,
    ':d7d': d7d,
    ':m': data.mentions,
    ':u': now,
    ':sym': sym,
    ':g2p': tracked.gsi2pk,
    ':g2s': tracked.gsi2sk,
  }

  // Per-window: set or remove the GSI spike keys.
  type Window = '1H' | '24H' | '7D'
  const windows: Window[] = ['1H', '24H', '7D']
  const deltaValues: Record<Window, number> = { '1H': d1h, '24H': d24h, '7D': d7d }

  for (const w of windows) {
    const delta = deltaValues[w]
    const gsiKeys = tokenSpikeWindowGsi(w, delta, sym)
    const [pkAttr, skAttr] = Object.keys(gsiKeys)

    if (delta > 0) {
      const pkPlaceholder = `:${pkAttr}`
      const skPlaceholder = `:${skAttr}`
      setExprParts.push(`${pkAttr} = ${pkPlaceholder}`)
      setExprParts.push(`${skAttr} = ${skPlaceholder}`)
      values[pkPlaceholder] = gsiKeys[pkAttr]
      values[skPlaceholder] = gsiKeys[skAttr]
    } else {
      removeExprParts.push(pkAttr)
      removeExprParts.push(skAttr)
    }
  }

  let updateExpression = `SET ${setExprParts.join(', ')}`
  if (removeExprParts.length > 0) {
    updateExpression += ` REMOVE ${removeExprParts.join(', ')}`
  }

  await ddb.send(new UpdateCommand({
    TableName: TableNames.tokens,
    Key: tokenKey(sym),
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: values,
  }))
}

export async function writeFollowerSnapshot(data: FollowerSnapshot): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TableNames.tokens,
    Item: data,
  }))
}
