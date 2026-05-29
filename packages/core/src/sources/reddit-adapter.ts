import { searchPosts, postToRawTweet, RedditQuotaError } from '../lib/reddit'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet } from '../db/tweets'
import { canUseReddit, recordRedditUsage } from '../db/usage'
import type { SourceAdapter, IngestOpts, IngestResult } from './types'

async function ingestReddit(
  query: string,
  opts: IngestOpts | undefined,
  maxPages: number,
  methodName: string,
): Promise<IngestResult> {
  const userId = opts?.userId

  // Quota gate — check before fetching
  if (userId) {
    const q = await canUseReddit(userId)
    if (!q.allowed) {
      throw new RedditQuotaError(
        `Reddit monthly quota exhausted (${q.used}/${q.limit})`,
      )
    }
  }

  const { posts, requestCount } = await searchPosts(query, { maxPages })

  // Metering — record usage best-effort after fetching
  if (userId) {
    try {
      await recordRedditUsage(userId, requestCount)
    } catch (err) {
      console.error(`[redditAdapter.${methodName}] recordRedditUsage failed:`, err)
    }
  }

  const writeResults = await Promise.allSettled(
    posts.map(async (post) => {
      const raw = postToRawTweet(post)
      const tweet = enrichRawTweet(raw, query, { source: 'reddit' })
      await putTweet(tweet)
    }),
  )

  let ingested = 0
  for (const result of writeResults) {
    if (result.status === 'fulfilled') {
      ingested++
    } else {
      console.error(`[redditAdapter.${methodName}] putTweet failed:`, result.reason)
    }
  }

  return { source: 'reddit', ingested }
}

export const redditAdapter: SourceAdapter = {
  id: 'reddit',
  displayName: 'Reddit',
  minPlan: 'pro',
  pollIntervalMs: 20 * 60 * 1000,
  implemented: true,
  byokProvider: null,

  async search(_apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestReddit(query, opts, opts?.maxPages ?? 3, 'search')
  },

  async since(_apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestReddit(query, opts, 2, 'since')
  },
}
