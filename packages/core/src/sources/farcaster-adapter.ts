import { searchCasts, castToRawTweet, FarcasterApiError } from '../lib/farcaster'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet } from '../db/tweets'
import type { SourceAdapter, IngestOpts, IngestResult } from './types'

export const farcasterAdapter: SourceAdapter = {
  id: 'farcaster',
  displayName: 'Farcaster',
  minPlan: 'free',
  pollIntervalMs: 2 * 60 * 1000,
  implemented: true,
  byokProvider: null,

  async search(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    const key = apiKey || process.env.NEYNAR_API_KEY
    if (!key) {
      throw new FarcasterApiError('NEYNAR_API_KEY is not configured', 500)
    }

    const casts = await searchCasts(key, query, { maxPages: opts?.maxPages })

    const writeResults = await Promise.allSettled(
      casts.map(async (cast) => {
        const raw = castToRawTweet(cast)
        const tweet = enrichRawTweet(raw, query, { source: 'farcaster' })
        await putTweet(tweet)
      }),
    )

    let ingested = 0
    for (const result of writeResults) {
      if (result.status === 'fulfilled') {
        ingested++
      } else {
        console.error('[farcasterAdapter.search] putTweet failed:', result.reason)
      }
    }

    return { source: 'farcaster', ingested }
  },

  async since(apiKey: string, query: string, _opts?: IngestOpts): Promise<IngestResult> {
    const key = apiKey || process.env.NEYNAR_API_KEY
    if (!key) {
      throw new FarcasterApiError('NEYNAR_API_KEY is not configured', 500)
    }

    const casts = await searchCasts(key, query, { maxPages: 2 })

    const writeResults = await Promise.allSettled(
      casts.map(async (cast) => {
        const raw = castToRawTweet(cast)
        const tweet = enrichRawTweet(raw, query, { source: 'farcaster' })
        await putTweet(tweet)
      }),
    )

    let ingested = 0
    for (const result of writeResults) {
      if (result.status === 'fulfilled') {
        ingested++
      } else {
        console.error('[farcasterAdapter.since] putTweet failed:', result.reason)
      }
    }

    return { source: 'farcaster', ingested }
  },
}
