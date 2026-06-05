/**
 * Integration tests for the M14 Phase 2 NEWS firehose DB behaviors, using the
 * real dynalite harness against the Feeds table.
 *
 * Covers:
 *   (1) Fan-out — an article matching multiple symbols writes one NEWS row per
 *       symbol (each with its relevanceScore), readable via getFeedItems.
 *   (2) Firehose cursor — a NEWS_FIREHOSE_SYMBOL / 'NEWS' cursor round-trips.
 *   (3) relevanceScore round-trip — NEWS keeps its score; PRESS reads back
 *       with relevanceScore === undefined.
 */

import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

import {
  putFeedItem,
  getFeedItems,
  getFeedSourceCursor,
  upsertFeedSourceCursor,
} from '@monorepo-template/core/db/feeds'
import { entryId } from '@monorepo-template/core/lib/feeds'
import {
  matchSeedSymbols,
  NEWS_FIREHOSE_SYMBOL,
  type NewsArticle,
} from '@monorepo-template/core/lib/news-relevance'

const ENDPOINT = 'http://127.0.0.1:8000'

const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearFeeds(): Promise<void> {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.feeds,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.feeds,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await clearFeeds()
})

describe('NEWS fan-out (dynalite integration)', () => {
  test('(1) an article matching BTC + ETH writes one NEWS row per symbol with its relevanceScore', async () => {
    const article: NewsArticle = {
      guid: 'https://news.example/btc-eth-rally',
      link: 'https://news.example/btc-eth-rally',
      title: 'Bitcoin and Ethereum rally as ETF inflows surge',
      summary: 'BTC and ETH both posted double-digit gains amid renewed institutional demand.',
      publishedAt: '2026-06-01T12:00:00.000Z',
      sourceName: 'Example News',
    }

    const matches = matchSeedSymbols({ title: article.title, summary: article.summary })
    const bySymbol = new Map(matches.map((m) => [m.symbol, m]))
    expect(bySymbol.has('BTC')).toBe(true)
    expect(bySymbol.has('ETH')).toBe(true)

    const eid = entryId(article.guid, article.link)
    const ingestedAt = '2026-06-01T12:05:00.000Z'
    for (const match of matches) {
      await putFeedItem({
        symbol: match.symbol,
        kind: 'NEWS',
        entryId: eid,
        guid: article.guid,
        link: article.link,
        title: article.title,
        summary: article.summary,
        sourceName: article.sourceName,
        feedUrlHash: 'firehose-hash',
        publishedAt: article.publishedAt,
        ingestedAt,
        relevanceScore: match.score,
      })
    }

    const btcRows = await getFeedItems({ symbol: 'BTC', kind: 'NEWS' })
    expect(btcRows).toHaveLength(1)
    expect(btcRows[0].kind).toBe('NEWS')
    expect(btcRows[0].relevanceScore).toBe(bySymbol.get('BTC')!.score)

    const ethRows = await getFeedItems({ symbol: 'ETH', kind: 'NEWS' })
    expect(ethRows).toHaveLength(1)
    expect(ethRows[0].kind).toBe('NEWS')
    expect(ethRows[0].relevanceScore).toBe(bySymbol.get('ETH')!.score)
  })
})

describe('NEWS firehose cursor (dynalite integration)', () => {
  test('(2) firehose cursor round-trips under NEWS_FIREHOSE_SYMBOL / NEWS', async () => {
    const fHash = 'newsdata-firehose-hash'
    await upsertFeedSourceCursor({
      symbol: NEWS_FIREHOSE_SYMBOL,
      kind: 'NEWS',
      feedUrlHash: fHash,
      feedUrl: 'newsdata:firehose',
      etag: '"firehose-etag"',
      lastPublishedAt: '2026-06-01T12:00:00.000Z',
      updatedAt: '2026-06-01T12:05:00.000Z',
    })

    const stored = await getFeedSourceCursor(NEWS_FIREHOSE_SYMBOL, 'NEWS', fHash)
    expect(stored).not.toBeNull()
    expect(stored!.symbol).toBe(NEWS_FIREHOSE_SYMBOL)
    expect(stored!.kind).toBe('NEWS')
    expect(stored!.feedUrlHash).toBe(fHash)
    expect(stored!.feedUrl).toBe('newsdata:firehose')
    expect(stored!.etag).toBe('"firehose-etag"')
    expect(stored!.lastPublishedAt).toBe('2026-06-01T12:00:00.000Z')
    expect(stored!.updatedAt).toBe('2026-06-01T12:05:00.000Z')
  })
})

describe('relevanceScore round-trip (dynalite integration)', () => {
  test('(3) NEWS item keeps relevanceScore=3; PRESS item reads back with relevanceScore undefined', async () => {
    await putFeedItem({
      symbol: 'BTC',
      kind: 'NEWS',
      entryId: 'news-rs',
      guid: 'guid-news-rs',
      link: 'https://news.example/news-rs',
      title: 'A relevant Bitcoin story',
      sourceName: 'Example News',
      feedUrlHash: 'firehose-hash',
      publishedAt: '2026-06-01T10:00:00.000Z',
      ingestedAt: '2026-06-01T10:05:00.000Z',
      relevanceScore: 3,
    })

    await putFeedItem({
      symbol: 'BTC',
      kind: 'PRESS',
      entryId: 'press-rs',
      guid: 'guid-press-rs',
      link: 'https://bitcoin.org/blog/press-rs',
      title: 'Bitcoin Core release',
      sourceName: 'Bitcoin.org Blog',
      feedUrlHash: 'press-hash',
      publishedAt: '2026-06-01T11:00:00.000Z',
      ingestedAt: '2026-06-01T11:05:00.000Z',
    })

    const newsRows = await getFeedItems({ symbol: 'BTC', kind: 'NEWS' })
    expect(newsRows).toHaveLength(1)
    expect(newsRows[0].relevanceScore).toBe(3)

    const pressRows = await getFeedItems({ symbol: 'BTC', kind: 'PRESS' })
    expect(pressRows).toHaveLength(1)
    expect(pressRows[0].relevanceScore).toBeUndefined()
  })
})
