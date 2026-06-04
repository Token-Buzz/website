import type { Handler } from 'aws-lambda'
import { fetchFeed, feedUrlHash, entryId } from '@monorepo-template/core/lib/feeds'
import { putFeedItem, getFeedSourceCursor, upsertFeedSourceCursor } from '@monorepo-template/core/db/feeds'
import { getTokenProfile } from '@monorepo-template/core/db/token-profile'
import { CURATED_PRESS_SEED } from '@monorepo-template/core/db/feed-seed'

export const handler: Handler = async () => {
  const symbols = Object.keys(CURATED_PRESS_SEED)
  console.log(`FeedPoller: processing ${symbols.length} symbols`)

  for (const symbol of symbols) {
    try {
      const profile = await getTokenProfile(symbol)
      if (!profile?.pressFeedUrl) {
        console.log(`FeedPoller: ${symbol} — no pressFeedUrl, skipping`)
        continue
      }

      const fUrl = profile.pressFeedUrl
      const fHash = feedUrlHash(fUrl)
      const cursor = await getFeedSourceCursor(symbol, 'PRESS', fHash)
      const now = new Date().toISOString()

      let res
      try {
        res = await fetchFeed(fUrl, { etag: cursor?.etag, lastModified: cursor?.lastModified })
      } catch (fetchErr) {
        const errorCount = (cursor?.errorCount ?? 0) + 1
        await upsertFeedSourceCursor({
          symbol,
          kind: 'PRESS',
          feedUrlHash: fHash,
          feedUrl: fUrl,
          ...(cursor?.lastPublishedAt !== undefined && { lastPublishedAt: cursor.lastPublishedAt }),
          ...(cursor?.etag !== undefined && { etag: cursor.etag }),
          ...(cursor?.lastModified !== undefined && { lastModified: cursor.lastModified }),
          errorCount,
          lastError: String(fetchErr),
          updatedAt: now,
        })
        console.error(`FeedPoller: ${symbol} — fetch failed (errorCount=${errorCount}):`, fetchErr)
        continue
      }

      if (res.notModified) {
        // Refresh updatedAt and reset errorCount; preserve all other cursor fields
        await upsertFeedSourceCursor({
          symbol,
          kind: 'PRESS',
          feedUrlHash: fHash,
          feedUrl: fUrl,
          ...(cursor?.lastPublishedAt !== undefined && { lastPublishedAt: cursor.lastPublishedAt }),
          ...(cursor?.etag !== undefined && { etag: cursor.etag }),
          ...(cursor?.lastModified !== undefined && { lastModified: cursor.lastModified }),
          errorCount: 0,
          updatedAt: now,
        })
        console.log(`FeedPoller: ${symbol} — 304 Not Modified`)
        continue
      }

      const highWater = cursor?.lastPublishedAt
      let inserted = 0
      let skipped = 0
      let newestPublishedAt: string | undefined

      for (const entry of res.entries) {
        // High-water mark filter: skip entries we've already seen
        if (highWater && entry.publishedAt <= highWater) {
          skipped++
          continue
        }

        const eid = entryId(entry.guid, entry.link)
        const wasNew = await putFeedItem({
          symbol,
          kind: 'PRESS',
          entryId: eid,
          guid: entry.guid,
          link: entry.link,
          title: entry.title,
          ...(entry.summary !== undefined && { summary: entry.summary }),
          sourceName: res.sourceName ?? symbol,
          feedUrlHash: fHash,
          publishedAt: entry.publishedAt,
          ingestedAt: now,
        })

        if (wasNew) {
          inserted++
          if (!newestPublishedAt || entry.publishedAt > newestPublishedAt) {
            newestPublishedAt = entry.publishedAt
          }
        }
      }

      // Advance high-water mark to the newest entry we saw
      const newLastPublishedAt = newestPublishedAt
        ? newestPublishedAt > (highWater ?? '') ? newestPublishedAt : highWater
        : highWater

      await upsertFeedSourceCursor({
        symbol,
        kind: 'PRESS',
        feedUrlHash: fHash,
        feedUrl: fUrl,
        ...(newLastPublishedAt !== undefined && { lastPublishedAt: newLastPublishedAt }),
        ...(res.etag !== undefined && { etag: res.etag }),
        ...(res.lastModified !== undefined && { lastModified: res.lastModified }),
        errorCount: 0,
        updatedAt: now,
      })

      console.log(
        `FeedPoller: ${symbol} — ingested=${inserted} skipped=${skipped} total=${res.entries.length}`,
      )
    } catch (err) {
      console.error(`FeedPoller: ${symbol} — unexpected error:`, err)
    }
  }

  console.log('FeedPoller: done')
}
