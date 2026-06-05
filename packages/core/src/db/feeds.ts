import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { feedItemKey, feedTokenGsi, feedGuidGsi, feedSourceKey } from './keys'

export interface FeedItemRecord {
  symbol: string         // uppercase
  kind: 'PRESS' | 'NEWS'
  entryId: string        // sha1(guid || link)
  guid: string
  link: string
  title: string
  summary?: string
  sourceName: string
  feedUrlHash: string
  publishedAt: string    // ISO-8601
  ingestedAt: string     // ISO-8601
  relevanceScore?: number // optional: keyword-match score for NEWS items; omitted for PRESS
}

export interface FeedSourceCursorRecord {
  symbol: string
  kind: 'PRESS' | 'NEWS'
  feedUrlHash: string
  feedUrl: string
  lastPublishedAt?: string  // ISO
  etag?: string
  lastModified?: string
  errorCount?: number
  lastError?: string
  updatedAt: string
}

/**
 * Writes a feed entry to the Feeds table.
 * Uses `attribute_not_exists(pk)` so duplicate writes (same symbol+kind+ts+entryId)
 * are idempotent — at-least-once-safe dedup layer 2 (layer 1 is the high-water mark).
 * Returns true on success, false if the item already existed.
 */
export async function putFeedItem(item: FeedItemRecord): Promise<boolean> {
  const sym = item.symbol.toUpperCase()
  const baseKeys = feedItemKey(sym, item.kind, item.publishedAt, item.entryId)
  const gsi1 = feedTokenGsi(sym, item.kind, item.publishedAt, item.entryId)
  const gsi2 = feedGuidGsi(item.feedUrlHash, item.entryId)

  try {
    await ddb.send(new PutCommand({
      TableName: TableNames.feeds,
      Item: {
        ...baseKeys,
        ...gsi1,
        ...gsi2,
        symbol: sym,
        kind: item.kind,
        entryId: item.entryId,
        guid: item.guid,
        link: item.link,
        title: item.title,
        ...(item.summary !== undefined && { summary: item.summary }),
        sourceName: item.sourceName,
        feedUrlHash: item.feedUrlHash,
        publishedAt: item.publishedAt,
        ingestedAt: item.ingestedAt,
        ...(item.relevanceScore !== undefined && { relevanceScore: item.relevanceScore }),
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }))
    return true
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return false
    }
    throw err
  }
}

/**
 * Queries feed entries for a symbol, optionally filtered by kind.
 * When kind is specified, queries the base table by pk=`FEED#<SYM>#<KIND>`.
 * When kind is omitted, queries the FeedByTokenKindTime GSI by gsi1pk=`FEED#<SYM>`.
 * Results are returned newest-first (descending by sort key).
 * `from`/`to` are ISO timestamps bounding the sort key range.
 */
export async function getFeedItems(opts: {
  symbol: string
  kind?: 'PRESS' | 'NEWS'
  limit?: number
  from?: string
  to?: string
}): Promise<FeedItemRecord[]> {
  const { symbol, kind, limit = 50, from, to } = opts
  const sym = symbol.toUpperCase()

  let keyCondition = kind
    ? 'pk = :pk'
    : 'gsi1pk = :pk'

  const exprValues: Record<string, string> = {
    ':pk': kind ? `FEED#${sym}#${kind}` : `FEED#${sym}`,
  }

  if (from && to) {
    keyCondition += ' AND sk BETWEEN :from AND :to'
    exprValues[':from'] = from
    exprValues[':to'] = to
  } else if (from) {
    keyCondition += ' AND sk >= :from'
    exprValues[':from'] = from
  } else if (to) {
    keyCondition += ' AND sk <= :to'
    exprValues[':to'] = to
  }

  const cmd = new QueryCommand({
    TableName: TableNames.feeds,
    ...(kind ? {} : { IndexName: 'FeedByTokenKindTime' }),
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: exprValues,
    ScanIndexForward: false,
    Limit: limit,
  })

  const { Items = [] } = await ddb.send(cmd)

  return (Items as Array<Record<string, unknown>>).map((item): FeedItemRecord => ({
    symbol: item['symbol'] as string,
    kind: item['kind'] as 'PRESS' | 'NEWS',
    entryId: item['entryId'] as string,
    guid: item['guid'] as string,
    link: item['link'] as string,
    title: item['title'] as string,
    ...(item['summary'] !== undefined && { summary: item['summary'] as string }),
    sourceName: item['sourceName'] as string,
    feedUrlHash: item['feedUrlHash'] as string,
    publishedAt: item['publishedAt'] as string,
    ingestedAt: item['ingestedAt'] as string,
    ...(item['relevanceScore'] !== undefined && { relevanceScore: item['relevanceScore'] as number }),
  }))
}

/**
 * Returns the poll cursor row for a given (symbol, kind, feedUrlHash), or null
 * if the feed has never been polled.
 */
export async function getFeedSourceCursor(
  symbol: string,
  kind: string,
  feedUrlHash: string,
): Promise<FeedSourceCursorRecord | null> {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TableNames.feeds,
    Key: feedSourceKey(symbol, kind, feedUrlHash),
  }))
  if (!Item) return null

  return {
    symbol: Item['symbol'] as string,
    kind: Item['kind'] as 'PRESS' | 'NEWS',
    feedUrlHash: Item['feedUrlHash'] as string,
    feedUrl: Item['feedUrl'] as string,
    ...(Item['lastPublishedAt'] !== undefined && { lastPublishedAt: Item['lastPublishedAt'] as string }),
    ...(Item['etag'] !== undefined && { etag: Item['etag'] as string }),
    ...(Item['lastModified'] !== undefined && { lastModified: Item['lastModified'] as string }),
    ...(Item['errorCount'] !== undefined && { errorCount: Item['errorCount'] as number }),
    ...(Item['lastError'] !== undefined && { lastError: Item['lastError'] as string }),
    updatedAt: Item['updatedAt'] as string,
  }
}

/**
 * Writes (or overwrites) the poll cursor row for a feed source.
 * Stores lastPublishedAt, etag, lastModified, errorCount, lastError, updatedAt.
 */
export async function upsertFeedSourceCursor(cursor: FeedSourceCursorRecord): Promise<void> {
  const sym = cursor.symbol.toUpperCase()
  const keys = feedSourceKey(sym, cursor.kind, cursor.feedUrlHash)

  await ddb.send(new PutCommand({
    TableName: TableNames.feeds,
    Item: {
      ...keys,
      symbol: sym,
      kind: cursor.kind,
      feedUrlHash: cursor.feedUrlHash,
      feedUrl: cursor.feedUrl,
      ...(cursor.lastPublishedAt !== undefined && { lastPublishedAt: cursor.lastPublishedAt }),
      ...(cursor.etag !== undefined && { etag: cursor.etag }),
      ...(cursor.lastModified !== undefined && { lastModified: cursor.lastModified }),
      ...(cursor.errorCount !== undefined && { errorCount: cursor.errorCount }),
      ...(cursor.lastError !== undefined && { lastError: cursor.lastError }),
      updatedAt: cursor.updatedAt,
    },
  }))
}
