/**
 * Pure merge/cursor helper for the Live Feed feature.
 * No DB imports — keeps this trivially unit-testable without an SST stage.
 */

export type LiveFeedSentiment = 'bull' | 'bear' | 'neu'

/** Minimal shape required by mergeLiveFeed; TweetRecord satisfies this. */
export interface LiveFeedItem {
  tweetId: string
  createdAt: string
}

export interface MergeLiveFeedResult<T extends LiveFeedItem> {
  tweets: T[]
  /**
   * The composite sort key `'<createdAt>#<tweetId>'` of the last (oldest)
   * tweet in the returned page, present only when the result is exactly
   * `limit` items (indicating there may be more). Pass as `before` to
   * `getRecentTweetsByQuery` (or base64-encode it as the cursor for the HTTP
   * API) to fetch the next page.
   */
  nextCursorSk: string | undefined
}

/**
 * Merge per-query tweet pages into a single newest-first feed.
 *
 * @param pages - One array of tweets per query, each already sorted
 *   newest-first. Items may overlap across pages (same tweetId).
 * @param limit - Maximum number of tweets to return.
 */
export function mergeLiveFeed<T extends LiveFeedItem>(
  pages: T[][],
  limit: number,
): MergeLiveFeedResult<T> {
  if (pages.length === 0 || limit <= 0) {
    return { tweets: [], nextCursorSk: undefined }
  }

  // Flatten and dedupe by tweetId (keep first occurrence).
  const seen = new Set<string>()
  const all: T[] = []
  for (const page of pages) {
    for (const item of page) {
      if (!seen.has(item.tweetId)) {
        seen.add(item.tweetId)
        all.push(item)
      }
    }
  }

  // Sort descending by composite key '<createdAt>#<tweetId>'.
  // ISO-8601 timestamps are lexicographically sortable, so string comparison
  // is correct. The tweetId suffix breaks ties deterministically.
  all.sort((a, b) => {
    const keyA = `${a.createdAt}#${a.tweetId}`
    const keyB = `${b.createdAt}#${b.tweetId}`
    return keyB.localeCompare(keyA)
  })

  const tweets = all.slice(0, limit)

  const nextCursorSk =
    tweets.length === limit
      ? `${tweets[tweets.length - 1].createdAt}#${tweets[tweets.length - 1].tweetId}`
      : undefined

  return { tweets, nextCursorSk }
}
