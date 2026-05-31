import { GetCommand, PutCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { ohlcvKey, tokenRefKey } from './keys'
import {
  type OHLCVBar,
  type TokenRef,
  type TokenCandidate,
  type PriceProvider,
  type PriceInterval,
  missingBuckets,
  ttlForBucket,
} from '../providers/price'
import { geckoTerminalProvider } from '../providers/geckoterminal'
import { checkAndIncrement, GECKOTERMINAL_LIMIT } from './rate-limit'

export interface OHLCVRecord {
  pk: string
  sk: string
  ts: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  ttl?: number
}

export async function getCachedRef(symbol: string): Promise<TokenRef | null> {
  const key = tokenRefKey(symbol)
  const res = await ddb.send(
    new GetCommand({ TableName: TableNames.tokens, Key: key }),
  )
  if (!res.Item) return null
  const item = res.Item as Record<string, unknown>
  const sym = item.symbol
  const mint = item.mint
  const pool = item.pool
  const chain = item.chain
  const source = item.source
  if (
    typeof sym !== 'string' ||
    typeof mint !== 'string' ||
    typeof pool !== 'string' ||
    typeof chain !== 'string' ||
    typeof source !== 'string'
  ) return null
  return { symbol: sym, mint, pool, chain, source }
}

export async function resolveRef(symbol: string, provider: PriceProvider): Promise<TokenRef | null> {
  const cached = await getCachedRef(symbol)
  if (cached) return cached

  const ref = await provider.resolve(symbol)
  if (!ref) return null

  await ddb.send(
    new PutCommand({
      TableName: TableNames.tokens,
      Item: { ...tokenRefKey(symbol), ...ref },
    }),
  )
  return ref
}

export async function searchTokenCandidates(
  symbol: string,
  provider: PriceProvider = geckoTerminalProvider,
): Promise<TokenCandidate[]> {
  return provider.search(symbol)
}

/**
 * Overwrite the cached TokenRef for `symbol` with `ref`, then invalidate all
 * cached OHLCV rows for that symbol so the chart refetches from the new pool.
 *
 * OHLCV invalidation: query all sk values beginning with "OHLCV#" on the
 * TOKEN#<SYM> partition and delete them in batches of 25.
 */
export async function setRef(symbol: string, ref: TokenRef): Promise<void> {
  // Write the new ref.
  await ddb.send(
    new PutCommand({
      TableName: TableNames.tokens,
      Item: { ...tokenRefKey(symbol), ...ref },
    }),
  )

  // Query all OHLCV rows for this symbol.
  const pk = `TOKEN#${symbol.toUpperCase()}`
  const res = await ddb.send(
    new QueryCommand({
      TableName: TableNames.tokens,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :p)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':p': 'OHLCV#',
      },
      ProjectionExpression: 'pk, sk',
    }),
  )

  const keys = (res.Items ?? []) as Array<{ pk: string; sk: string }>
  if (keys.length === 0) return

  // Delete in chunks of 25 (DynamoDB BatchWrite limit).
  const CHUNK = 25
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK)
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TableNames.tokens]: chunk.map((k) => ({
            DeleteRequest: { Key: { pk: k.pk, sk: k.sk } },
          })),
        },
      }),
    )
  }
}

export async function queryCachedOhlcv(
  symbol: string,
  interval: string,
  from: number,
  to: number,
): Promise<OHLCVBar[]> {
  const fromKey = ohlcvKey(symbol, interval, from)
  const toKey = ohlcvKey(symbol, interval, to)

  const res = await ddb.send(
    new QueryCommand({
      TableName: TableNames.tokens,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':pk': fromKey.pk,
        ':from': fromKey.sk,
        ':to': toKey.sk,
      },
    }),
  )

  const items = (res.Items ?? []) as Array<Record<string, unknown>>
  return items
    .map((item) => ({
      ts: item.ts as number,
      open: item.open as number,
      high: item.high as number,
      low: item.low as number,
      close: item.close as number,
      volume: item.volume as number,
    }))
    .sort((a, b) => a.ts - b.ts)
}

export async function writeOhlcvBuckets(
  symbol: string,
  interval: string,
  bars: OHLCVBar[],
  nowSec: number,
): Promise<void> {
  for (const bar of bars) {
    await ddb.send(
      new PutCommand({
        TableName: TableNames.tokens,
        Item: {
          ...ohlcvKey(symbol, interval, bar.ts),
          ts: bar.ts,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          ttl: ttlForBucket(bar.ts, nowSec),
        },
      }),
    )
  }
}

export async function getOHLCV(
  symbol: string,
  interval: PriceInterval,
  from: number,
  to: number,
  provider: PriceProvider = geckoTerminalProvider,
): Promise<{ bars: OHLCVBar[]; rateLimited: boolean; retryAfterSec: number }> {
  const cached = await queryCachedOhlcv(symbol, interval, from, to)
  const cachedTs = new Set(cached.map((b) => b.ts))

  const missing = missingBuckets(from, to, interval, cachedTs)
  if (missing.length === 0) return { bars: cached, rateLimited: false, retryAfterSec: 0 }

  const ref = await resolveRef(symbol, provider)
  if (!ref) return { bars: cached, rateLimited: false, retryAfterSec: 0 }

  // Rate-limit check before calling the external provider
  const rl = await checkAndIncrement(provider.id, GECKOTERMINAL_LIMIT)
  if (!rl.allowed) {
    console.warn(`getOHLCV: rate limit reached for ${provider.id} (${rl.count}/${GECKOTERMINAL_LIMIT}), serving stale cache`)
    return { bars: cached, rateLimited: true, retryAfterSec: rl.retryAfterSec }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  let fresh: OHLCVBar[] = []
  try {
    fresh = await provider.fetchOHLCV(ref, interval, Math.min(...missing), Math.max(...missing))
  } catch (err) {
    console.error('getOHLCV: provider fetch failed, returning cached bars', err)
    return { bars: cached, rateLimited: false, retryAfterSec: 0 }
  }

  await writeOhlcvBuckets(symbol, interval, fresh, nowSec)

  // Merge cached + fresh; fresh wins on ts collision; filter to [from, to]; sort ascending.
  const byTs = new Map<number, OHLCVBar>()
  for (const bar of cached) byTs.set(bar.ts, bar)
  for (const bar of fresh) byTs.set(bar.ts, bar)

  const bars = Array.from(byTs.values())
    .filter((b) => b.ts >= from && b.ts <= to)
    .sort((a, b) => a.ts - b.ts)

  return { bars, rateLimited: false, retryAfterSec: 0 }
}
