import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { ohlcvKey, tokenMintKey } from './keys'
import {
  type OHLCVBar,
  type MintInfo,
  type PriceProvider,
  type PriceInterval,
  missingBuckets,
  ttlForBucket,
} from '../providers/price'
import { birdeyeProvider } from '../providers/birdeye'

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

export async function getCachedMint(symbol: string): Promise<MintInfo | null> {
  const key = tokenMintKey(symbol)
  const res = await ddb.send(
    new GetCommand({ TableName: TableNames.tokens, Key: key }),
  )
  if (!res.Item) return null
  const item = res.Item as Record<string, unknown>
  const mint = item.mint
  const chain = item.chain
  const source = item.source
  if (typeof mint !== 'string' || typeof chain !== 'string' || typeof source !== 'string') return null
  return { mint, chain, source }
}

export async function resolveMint(symbol: string, provider: PriceProvider): Promise<MintInfo | null> {
  const cached = await getCachedMint(symbol)
  if (cached) return cached

  const mintInfo = await provider.resolveMint(symbol)
  if (!mintInfo) return null

  await ddb.send(
    new PutCommand({
      TableName: TableNames.tokens,
      Item: { ...tokenMintKey(symbol), ...mintInfo },
    }),
  )
  return mintInfo
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
  provider: PriceProvider = birdeyeProvider,
): Promise<OHLCVBar[]> {
  const cached = await queryCachedOhlcv(symbol, interval, from, to)
  const cachedTs = new Set(cached.map((b) => b.ts))

  const missing = missingBuckets(from, to, interval, cachedTs)
  if (missing.length === 0) return cached

  const mint = await resolveMint(symbol, provider)
  if (!mint) return cached

  const nowSec = Math.floor(Date.now() / 1000)
  let fresh: OHLCVBar[] = []
  try {
    fresh = await provider.fetchOHLCV(mint.mint, interval, Math.min(...missing), Math.max(...missing))
  } catch (err) {
    console.error('getOHLCV: provider fetch failed, returning cached bars', err)
    return cached
  }

  await writeOhlcvBuckets(symbol, interval, fresh, nowSec)

  // Merge cached + fresh; fresh wins on ts collision; filter to [from, to]; sort ascending.
  const byTs = new Map<number, OHLCVBar>()
  for (const bar of cached) byTs.set(bar.ts, bar)
  for (const bar of fresh) byTs.set(bar.ts, bar)

  return Array.from(byTs.values())
    .filter((b) => b.ts >= from && b.ts <= to)
    .sort((a, b) => a.ts - b.ts)
}
