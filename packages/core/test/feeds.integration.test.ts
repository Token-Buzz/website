/**
 * Integration tests for packages/core/src/db/feeds.ts using the real
 * dynalite harness against the Feeds table.
 *
 * Covers:
 *   (a) putFeedItem round-trip — all fields survive write→read.
 *   (b) putFeedItem idempotency — duplicate entryId returns false, one row.
 *   (c) getFeedItems descending — items returned newest-first.
 *   (d) getFeedItems without kind — queries FeedByTokenKindTime GSI.
 *   (e) cursor round-trip — upsert then get returns the same record.
 *   (f) cursor upsert overwrites — second upsert with new etag replaces first.
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
  type FeedItemRecord,
  type FeedSourceCursorRecord,
} from '@monorepo-template/core/db/feeds'

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

function makeFeedItem(overrides: Partial<FeedItemRecord> = {}): FeedItemRecord {
  return {
    symbol: 'BTC',
    kind: 'PRESS',
    entryId: 'entry-001',
    guid: 'https://bitcoin.org/blog/2026/post-001',
    link: 'https://bitcoin.org/blog/2026/post-001',
    title: 'Bitcoin Core 28.0 Released',
    summary: 'The Bitcoin Core team has released version 28.0.',
    sourceName: 'Bitcoin.org Blog',
    feedUrlHash: 'feedhash-btc-press',
    publishedAt: '2026-05-30T10:00:00.000Z',
    ingestedAt: '2026-05-30T10:05:00.000Z',
    ...overrides,
  }
}

function makeCursor(overrides: Partial<FeedSourceCursorRecord> = {}): FeedSourceCursorRecord {
  return {
    symbol: 'BTC',
    kind: 'PRESS',
    feedUrlHash: 'feedhash-btc-press',
    feedUrl: 'https://bitcoin.org/en/rss/blog.xml',
    lastPublishedAt: '2026-05-30T10:00:00.000Z',
    etag: '"abc123"',
    updatedAt: '2026-05-30T10:05:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await clearFeeds()
})

describe('putFeedItem / getFeedItems (dynalite integration)', () => {
  test('(a) round-trip — all fields survive write→read', async () => {
    const item = makeFeedItem()
    const wrote = await putFeedItem(item)
    expect(wrote).toBe(true)

    const results = await getFeedItems({ symbol: 'BTC', kind: 'PRESS' })
    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r.symbol).toBe('BTC')
    expect(r.kind).toBe('PRESS')
    expect(r.entryId).toBe('entry-001')
    expect(r.guid).toBe(item.guid)
    expect(r.link).toBe(item.link)
    expect(r.title).toBe(item.title)
    expect(r.summary).toBe(item.summary)
    expect(r.sourceName).toBe(item.sourceName)
    expect(r.feedUrlHash).toBe(item.feedUrlHash)
    expect(r.publishedAt).toBe(item.publishedAt)
    expect(r.ingestedAt).toBe(item.ingestedAt)
  })

  test('(b) idempotency — writing the same entryId twice returns false, only one row exists', async () => {
    const item = makeFeedItem()
    const first = await putFeedItem(item)
    const second = await putFeedItem(item)

    expect(first).toBe(true)
    expect(second).toBe(false)

    const results = await getFeedItems({ symbol: 'BTC', kind: 'PRESS' })
    expect(results).toHaveLength(1)
  })

  test('(c) getFeedItems descending — 3 items returned newest-first', async () => {
    await putFeedItem(makeFeedItem({
      entryId: 'e-old',
      publishedAt: '2026-05-28T10:00:00.000Z',
      ingestedAt: '2026-05-28T10:01:00.000Z',
    }))
    await putFeedItem(makeFeedItem({
      entryId: 'e-mid',
      publishedAt: '2026-05-29T10:00:00.000Z',
      ingestedAt: '2026-05-29T10:01:00.000Z',
    }))
    await putFeedItem(makeFeedItem({
      entryId: 'e-new',
      publishedAt: '2026-05-30T10:00:00.000Z',
      ingestedAt: '2026-05-30T10:01:00.000Z',
    }))

    const results = await getFeedItems({ symbol: 'BTC', kind: 'PRESS' })
    expect(results).toHaveLength(3)
    // Newest first
    expect(results[0].entryId).toBe('e-new')
    expect(results[1].entryId).toBe('e-mid')
    expect(results[2].entryId).toBe('e-old')
  })

  test('(d) getFeedItems without kind — queries GSI and returns PRESS + NEWS rows', async () => {
    await putFeedItem(makeFeedItem({
      kind: 'PRESS',
      entryId: 'press-1',
      publishedAt: '2026-05-30T09:00:00.000Z',
      ingestedAt: '2026-05-30T09:01:00.000Z',
    }))
    await putFeedItem(makeFeedItem({
      kind: 'NEWS',
      entryId: 'news-1',
      publishedAt: '2026-05-30T10:00:00.000Z',
      ingestedAt: '2026-05-30T10:01:00.000Z',
    }))

    const results = await getFeedItems({ symbol: 'BTC' })
    expect(results).toHaveLength(2)
    const kinds = results.map((r) => r.kind)
    expect(kinds).toContain('PRESS')
    expect(kinds).toContain('NEWS')
  })
})

describe('getFeedSourceCursor / upsertFeedSourceCursor (dynalite integration)', () => {
  test('(e) cursor round-trip — all fields survive upsert→get', async () => {
    const cursor = makeCursor()
    await upsertFeedSourceCursor(cursor)

    const stored = await getFeedSourceCursor('BTC', 'PRESS', 'feedhash-btc-press')
    expect(stored).not.toBeNull()
    expect(stored!.symbol).toBe('BTC')
    expect(stored!.kind).toBe('PRESS')
    expect(stored!.feedUrlHash).toBe(cursor.feedUrlHash)
    expect(stored!.feedUrl).toBe(cursor.feedUrl)
    expect(stored!.lastPublishedAt).toBe(cursor.lastPublishedAt)
    expect(stored!.etag).toBe(cursor.etag)
    expect(stored!.updatedAt).toBe(cursor.updatedAt)
  })

  test('(f) cursor upsert overwrites — second upsert with new etag replaces first', async () => {
    await upsertFeedSourceCursor(makeCursor({ etag: '"first-etag"' }))
    await upsertFeedSourceCursor(makeCursor({ etag: '"second-etag"', updatedAt: '2026-05-30T11:00:00.000Z' }))

    const stored = await getFeedSourceCursor('BTC', 'PRESS', 'feedhash-btc-press')
    expect(stored).not.toBeNull()
    expect(stored!.etag).toBe('"second-etag"')
    expect(stored!.updatedAt).toBe('2026-05-30T11:00:00.000Z')
  })

  test('getFeedSourceCursor returns null when no cursor exists', async () => {
    const result = await getFeedSourceCursor('ETH', 'PRESS', 'no-such-hash')
    expect(result).toBeNull()
  })
})
