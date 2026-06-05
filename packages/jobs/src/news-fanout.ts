// Pure fan-out decision logic for the NEWS firehose poller.
//
// Kept in its own module — importing ONLY pure libs (lib/feeds, lib/news-relevance)
// and a type-only FeedItemRecord — so it can be unit-tested without booting an SST
// stage. The poller (news-poller.ts) re-exports planNewsFanOut from here and adds
// the DB/network I/O around it (db/feeds eagerly reads Resource.*.name at import,
// which is why that import must stay out of the unit-test path).

import { entryId } from '@monorepo-template/core/lib/feeds'
import { matchSeedSymbols, type NewsArticle } from '@monorepo-template/core/lib/news-relevance'
import type { FeedItemRecord } from '@monorepo-template/core/db/feeds'

export interface FanOutPlan {
  /** FeedItemRecord rows to write via putFeedItem (one per matched symbol per article). */
  items: FeedItemRecord[]
  /** Advanced high-water mark (max publishedAt across surviving articles), or undefined when none survived. */
  newHighWater?: string
}

/**
 * Pure fan-out decision logic for the NEWS firehose.
 *
 * For each article: drop it if it's at or below the current high-water mark
 * (already seen on a prior cycle). For surviving articles, run keyword matching
 * and emit one FeedItemRecord per matched symbol, stamped with the match score.
 *
 * IMPORTANT (high-water semantics): `newHighWater` advances to the max
 * `publishedAt` across ALL surviving (post-high-water) articles — regardless of
 * whether any symbol matched. This prevents newer-but-unmatched articles from
 * being re-evaluated every cycle (they'd never match, so re-checking is pure
 * waste). The conditional-put in `putFeedItem` (attribute_not_exists) remains
 * the correctness backstop for any article that slips through.
 */
export function planNewsFanOut(
  articles: NewsArticle[],
  feedHash: string,
  highWater: string | undefined,
  ingestedAt: string,
  threshold?: number,
): FanOutPlan {
  const items: FeedItemRecord[] = []
  let newHighWater: string | undefined

  for (const article of articles) {
    // High-water filter: skip articles we've already processed.
    if (highWater && article.publishedAt <= highWater) continue

    // Advance the high-water mark for every surviving article, matched or not.
    if (!newHighWater || article.publishedAt > newHighWater) {
      newHighWater = article.publishedAt
    }

    const matches = matchSeedSymbols(
      { title: article.title, ...(article.summary !== undefined && { summary: article.summary }) },
      threshold,
    )

    const eid = entryId(article.guid, article.link)
    for (const match of matches) {
      items.push({
        symbol: match.symbol,
        kind: 'NEWS',
        entryId: eid,
        guid: article.guid,
        link: article.link,
        title: article.title,
        ...(article.summary !== undefined && { summary: article.summary }),
        sourceName: article.sourceName,
        feedUrlHash: feedHash,
        publishedAt: article.publishedAt,
        ingestedAt,
        relevanceScore: match.score,
      })
    }
  }

  return { items, ...(newHighWater !== undefined && { newHighWater }) }
}
