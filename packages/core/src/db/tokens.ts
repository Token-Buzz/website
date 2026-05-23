import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { tokenKey, tokenSpikeGsi, tokenTrackedGsi } from './keys'

export interface TokenRecord {
  pk: string
  sk: string
  sym: string
  name: string
  price: number
  d24: number
  mentions: number
  dbuzz: number
  sent: 'bull' | 'bear' | 'neu'
  spark: number[]
  live?: boolean
  summary?: string
  updatedAt: string
  gsi1pk?: string
  gsi1sk?: string
  gsi2pk?: string
  gsi2sk?: string
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

export async function getSpikingTokens(opts: { limit?: number } = {}): Promise<TokenRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tokens,
    IndexName: 'SpikingByDelta',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': 'SPIKE' },
    ScanIndexForward: false,
    Limit: opts.limit ?? 20,
  }))
  return Items as TokenRecord[]
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
 * SpikingByDelta (gsi1) and WatchlistByMentions (gsi2) index keys so the token
 * surfaces in getSpikingTokens / listTrackedTokens. Uses UpdateCommand rather
 * than a full PUT so it never clobbers price/name/spark set elsewhere. A token
 * with no positive delta is dropped from the SPIKE index (gsi1 keys removed).
 */
export async function updateTokenBuzz(data: {
  symbol: string
  dbuzz: number
  mentions: number
}): Promise<void> {
  const sym = data.symbol.toUpperCase()
  const now = new Date().toISOString()
  const tracked = tokenTrackedGsi(data.mentions, sym)

  const common = {
    TableName: TableNames.tokens,
    Key: tokenKey(sym),
  }

  if (data.dbuzz > 0) {
    const spike = tokenSpikeGsi(data.dbuzz, sym)
    await ddb.send(new UpdateCommand({
      ...common,
      UpdateExpression:
        'SET dbuzz = :d, mentions = :m, updatedAt = :u, sym = if_not_exists(sym, :sym), ' +
        'gsi1pk = :g1p, gsi1sk = :g1s, gsi2pk = :g2p, gsi2sk = :g2s',
      ExpressionAttributeValues: {
        ':d': data.dbuzz,
        ':m': data.mentions,
        ':u': now,
        ':sym': sym,
        ':g1p': spike.gsi1pk,
        ':g1s': spike.gsi1sk,
        ':g2p': tracked.gsi2pk,
        ':g2s': tracked.gsi2sk,
      },
    }))
    return
  }

  await ddb.send(new UpdateCommand({
    ...common,
    UpdateExpression:
      'SET dbuzz = :d, mentions = :m, updatedAt = :u, sym = if_not_exists(sym, :sym), ' +
      'gsi2pk = :g2p, gsi2sk = :g2s REMOVE gsi1pk, gsi1sk',
    ExpressionAttributeValues: {
      ':d': data.dbuzz,
      ':m': data.mentions,
      ':u': now,
      ':sym': sym,
      ':g2p': tracked.gsi2pk,
      ':g2s': tracked.gsi2sk,
    },
  }))
}

export async function writeFollowerSnapshot(data: FollowerSnapshot): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TableNames.tokens,
    Item: data,
  }))
}
