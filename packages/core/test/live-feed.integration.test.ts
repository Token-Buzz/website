/**
 * Integration tests for getRecentTweetsByQuery using the real dynalite harness.
 *
 * Covers:
 *   (a) Returns newest-first results, capped at `limit`.
 *   (b) Cursor pagination via `before` returns the next older page with NO overlap.
 *   (c) Per-query partition isolation — a query returns only its own tweets.
 */
import { beforeEach, describe, expect, test } from 'vitest'
import { DynamoDBClient, ScanCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

import { putTweet, getRecentTweetsByQuery, type Tweet } from '@monorepo-template/core/db/tweets'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

const ENDPOINT = 'http://127.0.0.1:8000'

const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearTweets() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.tweets,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.tweets,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

/** Build a minimal valid Tweet for putTweet. */
function makeTweet(overrides: Partial<Tweet> & { tweetId: string; query: string; createdAt: string }): Tweet {
  return {
    tweetId: overrides.tweetId,
    query: overrides.query,
    createdAt: overrides.createdAt,
    text: overrides.text ?? `tweet ${overrides.tweetId}`,
    authorUsername: overrides.authorUsername ?? 'user',
    authorId: overrides.authorId ?? 'uid',
    authorName: overrides.authorName ?? 'Test User',
    authorFollowers: overrides.authorFollowers ?? 0,
    likeCount: overrides.likeCount ?? 0,
    retweetCount: overrides.retweetCount ?? 0,
    replyCount: overrides.replyCount ?? 0,
    quoteCount: overrides.quoteCount ?? 0,
    viewCount: overrides.viewCount ?? 0,
    bookmarkCount: overrides.bookmarkCount ?? 0,
    lang: overrides.lang ?? 'en',
    isReply: overrides.isReply ?? false,
    hashtags: overrides.hashtags ?? [],
    mentions: overrides.mentions ?? [],
    urls: overrides.urls ?? [],
    ...overrides,
  }
}

/**
 * Extract the composite sort-key that the cursor logic in the live-feed route
 * uses: '<createdAt>#<tweetId>'. This mirrors mergeLiveFeed's nextCursorSk and
 * the `before` param accepted by getRecentTweetsByQuery.
 *
 * Note: putTweet stores gsi1sk = ISO timestamp only (not timestamp#id), so a
 * `before` value of '<ts>#<id>' gives `gsi1sk < '<ts>#<id>'`, which includes
 * all items with gsi1sk = '<ts>' (because '<ts>' < '<ts>#...' lexicographically).
 * The integration tests below assert the observable pagination behaviour that
 * the production code actually provides.
 */
function cursorFor(tweet: { createdAt: string; tweetId: string }): string {
  return `${tweet.createdAt}#${tweet.tweetId}`
}

beforeEach(async () => {
  await clearTweets()
})

describe('getRecentTweetsByQuery (dynalite integration)', () => {
  test('(a) returns results newest-first, capped at limit', async () => {
    // Seed 5 tweets for the same query at different timestamps.
    const query = 'LF_TEST_A'
    const times = [
      '2024-01-15T05:00:00.000Z',
      '2024-01-15T04:00:00.000Z',
      '2024-01-15T03:00:00.000Z',
      '2024-01-15T02:00:00.000Z',
      '2024-01-15T01:00:00.000Z',
    ]
    for (let i = 0; i < times.length; i++) {
      await putTweet(makeTweet({ tweetId: `a-${i}`, query, createdAt: times[i] }))
    }

    // With limit 3 we should get the 3 newest.
    const result = await getRecentTweetsByQuery(query, { limit: 3 })
    expect(result).toHaveLength(3)

    // Verify newest-first order by comparing stored createdAt values.
    const resultTimes = result.map((r) => (r as unknown as { createdAt: string }).createdAt)
    expect(resultTimes[0]).toBe(times[0]) // newest
    expect(resultTimes[1]).toBe(times[1])
    expect(resultTimes[2]).toBe(times[2])
  })

  test('(b) cursor pagination returns next older page with no overlap', async () => {
    // Seed 6 tweets.
    const query = 'LF_TEST_B'
    const tweets = [
      { tweetId: 'b-0', createdAt: '2024-01-15T06:00:00.000Z' },
      { tweetId: 'b-1', createdAt: '2024-01-15T05:00:00.000Z' },
      { tweetId: 'b-2', createdAt: '2024-01-15T04:00:00.000Z' },
      { tweetId: 'b-3', createdAt: '2024-01-15T03:00:00.000Z' },
      { tweetId: 'b-4', createdAt: '2024-01-15T02:00:00.000Z' },
      { tweetId: 'b-5', createdAt: '2024-01-15T01:00:00.000Z' },
    ]
    for (const t of tweets) {
      await putTweet(makeTweet({ query, ...t }))
    }

    // Fetch first page (3 newest).
    const page1 = await getRecentTweetsByQuery(query, { limit: 3 })
    expect(page1).toHaveLength(3)
    const page1Ids = new Set(
      page1.map((r) => (r as unknown as { tweetId: string }).tweetId),
    )

    // Build cursor from the last (oldest) item on page 1.
    const lastOnPage1 = page1[page1.length - 1] as unknown as {
      tweetId: string
      createdAt: string
    }
    const before = cursorFor(lastOnPage1)

    // Fetch second page using the before cursor.
    const page2 = await getRecentTweetsByQuery(query, { before, limit: 3 })
    expect(page2.length).toBeGreaterThan(0)

    // No overlap: none of page2's tweetIds should appear in page1.
    const page2Ids = (page2 as unknown as Array<{ tweetId: string }>).map(
      (r) => r.tweetId,
    )
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false)
    }

    // Page 2 items are older than page 1 items.
    const page1Times = (page1 as unknown as Array<{ createdAt: string }>).map(
      (r) => r.createdAt,
    )
    const page2Times = (page2 as unknown as Array<{ createdAt: string }>).map(
      (r) => r.createdAt,
    )
    const oldestPage1 = page1Times[page1Times.length - 1]
    for (const t of page2Times) {
      // All page 2 items must be at or before the oldest page 1 item.
      expect(t <= oldestPage1).toBe(true)
    }
  })

  test('(c) per-query partition isolation — only returns tweets for the given query', async () => {
    const queryX = 'LF_TEST_C_X'
    const queryY = 'LF_TEST_C_Y'

    // Seed 3 tweets for queryX and 2 tweets for queryY.
    for (let i = 0; i < 3; i++) {
      await putTweet(
        makeTweet({
          tweetId: `cx-${i}`,
          query: queryX,
          createdAt: `2024-01-15T0${i + 1}:00:00.000Z`,
        }),
      )
    }
    for (let i = 0; i < 2; i++) {
      await putTweet(
        makeTweet({
          tweetId: `cy-${i}`,
          query: queryY,
          createdAt: `2024-01-15T0${i + 1}:00:00.000Z`,
        }),
      )
    }

    // Query for queryX should return exactly 3 results, all with query=queryX.
    const resultsX = await getRecentTweetsByQuery(queryX)
    expect(resultsX).toHaveLength(3)
    for (const r of resultsX as unknown as Array<{ query: string }>) {
      expect(r.query).toBe(queryX)
    }

    // Query for queryY should return exactly 2 results, none from queryX.
    const resultsY = await getRecentTweetsByQuery(queryY)
    expect(resultsY).toHaveLength(2)
    for (const r of resultsY as unknown as Array<{ query: string }>) {
      expect(r.query).toBe(queryY)
    }

    // Sanity: no cross-contamination of IDs.
    const xIds = (resultsX as unknown as Array<{ tweetId: string }>).map(
      (r) => r.tweetId,
    )
    const yIds = (resultsY as unknown as Array<{ tweetId: string }>).map(
      (r) => r.tweetId,
    )
    for (const id of yIds) {
      expect(xIds).not.toContain(id)
    }
  })

  test('returns empty array for a query with no tweets', async () => {
    const result = await getRecentTweetsByQuery('LF_TEST_EMPTY_QUERY')
    expect(result).toEqual([])
  })

  test('default limit of 30 is respected', async () => {
    const query = 'LF_TEST_DEFAULT_LIMIT'
    // Seed 35 tweets.
    for (let i = 0; i < 35; i++) {
      const ts = new Date(Date.now() - i * 60_000).toISOString()
      await putTweet(makeTweet({ tweetId: `dl-${i}`, query, createdAt: ts }))
    }
    // No explicit limit → default 30.
    const result = await getRecentTweetsByQuery(query)
    expect(result).toHaveLength(30)
  })
})
