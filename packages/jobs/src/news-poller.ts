import type { Handler } from 'aws-lambda'
import { fetchFeed, feedUrlHash } from '@monorepo-template/core/lib/feeds'
import {
  putFeedItem,
  getFeedSourceCursor,
  upsertFeedSourceCursor,
  type FeedItemRecord,
} from '@monorepo-template/core/db/feeds'
import {
  NEWS_FIREHOSE_SYMBOL,
  type NewsArticle,
} from '@monorepo-template/core/lib/news-relevance'
import { fetchNews as fetchNewsData } from '@monorepo-template/core/lib/newsdata'
import { fetchNews as fetchCryptoCompare } from '@monorepo-template/core/lib/cryptocompare'
import { getNewsFirehoseKey } from '@monorepo-template/core/db/byok-poll'
import { NEWS_OUTLET_FEEDS } from '@monorepo-template/core/db/news-outlets'
import { NEWSDATA_PROVIDER, CRYPTOCOMPARE_PROVIDER } from '@monorepo-template/core/providers'
import { planNewsFanOut } from './news-fanout'

// Pure fan-out decision logic lives in ./news-fanout (re-exported here) so it can
// be unit-tested without booting an SST stage — db/feeds eagerly reads
// Resource.*.name at import, which the unit suite can't satisfy.
export { planNewsFanOut, type FanOutPlan } from './news-fanout'

/** Picks the greater of two optional ISO strings (treats undefined as -infinity). */
function maxIso(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return a > b ? a : b
}

/**
 * Runs the shared fan-out for one source: filters by high-water, writes matched
 * rows, and returns counters + the advanced high-water mark to persist. Pure of
 * cursor I/O so each caller controls its own cursor write.
 */
async function processArticles(
  label: string,
  articles: NewsArticle[],
  feedHash: string,
  highWater: string | undefined,
  ingestedAt: string,
): Promise<{ inserted: number; matchedSymbols: number; newHighWater: string | undefined }> {
  const plan = planNewsFanOut(articles, feedHash, highWater, ingestedAt)

  let inserted = 0
  for (const item of plan.items) {
    const wasNew = await putFeedItem(item)
    if (wasNew) inserted++
  }

  console.log(
    `NewsPoller: ${label} — fetched=${articles.length} matched-symbols=${plan.items.length} inserted=${inserted}`,
  )

  return { inserted, matchedSymbols: plan.items.length, newHighWater: plan.newHighWater }
}

export const handler: Handler = async () => {
  console.log(
    `NewsPoller: processing ${NEWS_OUTLET_FEEDS.length} outlet RSS feeds + newsdata + cryptocompare firehoses`,
  )

  // ---- (a) Keyless outlet RSS feeds ----
  for (const outlet of NEWS_OUTLET_FEEDS) {
    try {
      const fHash = feedUrlHash(outlet.feedUrl)
      const cursor = await getFeedSourceCursor(NEWS_FIREHOSE_SYMBOL, 'NEWS', fHash)
      const now = new Date().toISOString()

      let res
      try {
        res = await fetchFeed(outlet.feedUrl, {
          etag: cursor?.etag,
          lastModified: cursor?.lastModified,
        })
      } catch (fetchErr) {
        const errorCount = (cursor?.errorCount ?? 0) + 1
        await upsertFeedSourceCursor({
          symbol: NEWS_FIREHOSE_SYMBOL,
          kind: 'NEWS',
          feedUrlHash: fHash,
          feedUrl: outlet.feedUrl,
          ...(cursor?.lastPublishedAt !== undefined && { lastPublishedAt: cursor.lastPublishedAt }),
          ...(cursor?.etag !== undefined && { etag: cursor.etag }),
          ...(cursor?.lastModified !== undefined && { lastModified: cursor.lastModified }),
          errorCount,
          lastError: String(fetchErr),
          updatedAt: now,
        })
        console.error(`NewsPoller: ${outlet.name} — fetch failed (errorCount=${errorCount}):`, fetchErr)
        continue
      }

      if (res.notModified) {
        // Refresh updatedAt and reset errorCount; preserve all other cursor fields.
        await upsertFeedSourceCursor({
          symbol: NEWS_FIREHOSE_SYMBOL,
          kind: 'NEWS',
          feedUrlHash: fHash,
          feedUrl: outlet.feedUrl,
          ...(cursor?.lastPublishedAt !== undefined && { lastPublishedAt: cursor.lastPublishedAt }),
          ...(cursor?.etag !== undefined && { etag: cursor.etag }),
          ...(cursor?.lastModified !== undefined && { lastModified: cursor.lastModified }),
          errorCount: 0,
          updatedAt: now,
        })
        console.log(`NewsPoller: ${outlet.name} — 304 Not Modified`)
        continue
      }

      const articles: NewsArticle[] = res.entries.map((entry) => ({
        guid: entry.guid,
        link: entry.link,
        title: entry.title,
        ...(entry.summary !== undefined && { summary: entry.summary }),
        publishedAt: entry.publishedAt,
        sourceName: res.sourceName ?? outlet.name,
      }))

      const highWater = cursor?.lastPublishedAt
      const { newHighWater } = await processArticles(outlet.name, articles, fHash, highWater, now)

      await upsertFeedSourceCursor({
        symbol: NEWS_FIREHOSE_SYMBOL,
        kind: 'NEWS',
        feedUrlHash: fHash,
        feedUrl: outlet.feedUrl,
        ...(() => {
          const lp = maxIso(newHighWater, highWater)
          return lp !== undefined ? { lastPublishedAt: lp } : {}
        })(),
        ...(res.etag !== undefined && { etag: res.etag }),
        ...(res.lastModified !== undefined && { lastModified: res.lastModified }),
        errorCount: 0,
        updatedAt: now,
      })
    } catch (err) {
      console.error(`NewsPoller: ${outlet.name} — unexpected error:`, err)
    }
  }

  // ---- (b) NewsData.io firehose (BYOK) ----
  await runJsonFirehose('newsdata', NEWSDATA_PROVIDER, fetchNewsData)

  // ---- (c) CryptoCompare firehose (BYOK) ----
  await runJsonFirehose('cryptocompare', CRYPTOCOMPARE_PROVIDER, fetchCryptoCompare)

  console.log('NewsPoller: done')
}

/**
 * Shared driver for the JSON-API BYOK firehoses (NewsData.io, CryptoCompare).
 * These APIs have no conditional GET, so dedup is high-water-only (no etag /
 * lastModified). No opted-in key holder → no-op (mirrors the BYOK crons).
 */
async function runJsonFirehose(
  label: string,
  provider: string,
  fetchNews: (apiKey: string) => Promise<NewsArticle[]>,
): Promise<void> {
  try {
    const key = await getNewsFirehoseKey(provider)
    if (!key) {
      console.log(`NewsPoller: ${label} — no opted-in key holder, skipping`)
      return
    }

    const syntheticId = `${label}:firehose`
    const fHash = feedUrlHash(syntheticId)
    const cursor = await getFeedSourceCursor(NEWS_FIREHOSE_SYMBOL, 'NEWS', fHash)
    const now = new Date().toISOString()

    let articles: NewsArticle[]
    try {
      articles = await fetchNews(key.apiKey)
    } catch (fetchErr) {
      const errorCount = (cursor?.errorCount ?? 0) + 1
      await upsertFeedSourceCursor({
        symbol: NEWS_FIREHOSE_SYMBOL,
        kind: 'NEWS',
        feedUrlHash: fHash,
        feedUrl: syntheticId,
        ...(cursor?.lastPublishedAt !== undefined && { lastPublishedAt: cursor.lastPublishedAt }),
        errorCount,
        lastError: String(fetchErr),
        updatedAt: now,
      })
      console.error(`NewsPoller: ${label} — fetch failed (errorCount=${errorCount}):`, fetchErr)
      return
    }

    const highWater = cursor?.lastPublishedAt
    const { newHighWater } = await processArticles(label, articles, fHash, highWater, now)

    await upsertFeedSourceCursor({
      symbol: NEWS_FIREHOSE_SYMBOL,
      kind: 'NEWS',
      feedUrlHash: fHash,
      feedUrl: syntheticId,
      ...(() => {
        const lp = maxIso(newHighWater, highWater)
        return lp !== undefined ? { lastPublishedAt: lp } : {}
      })(),
      errorCount: 0,
      updatedAt: now,
    })
  } catch (err) {
    console.error(`NewsPoller: ${label} — unexpected error:`, err)
  }
}
