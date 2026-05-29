import { searchPosts, postToRawTweet } from '../lib/reddit'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet } from '../db/tweets'
import { REDDIT_PROVIDER } from '../providers'
import type { SourceAdapter, IngestOpts, IngestResult } from './types'

async function ingestReddit(
  apiKey: string,
  query: string,
  opts: IngestOpts | undefined,
  maxPages: number,
  methodName: string,
): Promise<IngestResult> {
  const { posts } = await searchPosts(apiKey, query, { maxPages })

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
  minPlan: 'free',
  pollIntervalMs: 20 * 60 * 1000,
  implemented: true,
  byokProvider: REDDIT_PROVIDER,

  async search(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestReddit(apiKey, query, opts, opts?.maxPages ?? 3, 'search')
  },

  async since(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestReddit(apiKey, query, opts, 2, 'since')
  },
}
