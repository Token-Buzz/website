import { searchTweets } from '../lib/twitter'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet, getLatestTweetId } from '../db/tweets'
import { computeBotScore } from '../db/bot-heuristic'
import { lookupLocation, type City, type GeoResult } from '../db/geo'
import { TWITTER_PROVIDER } from '../db/byok'
import type { SourceAdapter, IngestOpts, IngestResult } from './types'

// ── Hand-rolled concurrency limiter ──────────────────────────────────────────
// Keeps at most `concurrency` tasks in-flight at once.
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

export const twitterAdapter: SourceAdapter = {
  id: 'twitter',
  displayName: 'X',
  minPlan: 'free',
  pollIntervalMs: 2 * 60 * 1000,
  implemented: true,
  byokProvider: TWITTER_PROVIDER,

  async search(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    const maxPages = opts?.maxPages
    // Let errors (incl. TwitterApiError) propagate to the caller.
    const rawTweets = await searchTweets(apiKey, query, { maxPages })

    if (rawTweets.length === 0) {
      return { source: 'twitter', ingested: 0 }
    }

    // ── Per-author deduplication maps (scoped to this call) ───────────────────
    // Bot score: compute once per unique author username
    const botScoreCache = new Map<string, number>()
    // Geo result: compute once per unique non-empty location string
    const geoCache = new Map<string, GeoResult | null>()

    // ── Collect unique locations for geo lookup (concurrent, concurrency=4) ───
    const uniqueLocations = Array.from(
      new Set(
        rawTweets
          .map((t) => t.author.location?.trim())
          .filter((loc): loc is string => !!loc),
      ),
    )

    const offlineCities = (opts?.offlineCities ?? []) as City[]

    const geoTasks = uniqueLocations.map(
      (loc) => async () => {
        try {
          const result = await lookupLocation(loc, { offlineCities })
          geoCache.set(loc, result)
        } catch {
          geoCache.set(loc, null)
        }
      },
    )

    await runWithConcurrency(geoTasks, 4)

    // ── Build and write Tweet records ─────────────────────────────────────────
    const writeResults = await Promise.allSettled(
      rawTweets.map(async (raw) => {
        const author = raw.author

        // Bot score — compute once per unique author username
        if (!botScoreCache.has(author.userName)) {
          let accountAgeDays = 0
          if (author.createdAt) {
            const createdMs = new Date(author.createdAt).getTime()
            if (!isNaN(createdMs)) {
              accountAgeDays = Math.max(
                0,
                (Date.now() - createdMs) / (1000 * 60 * 60 * 24),
              )
            }
          }
          const { botScore } = computeBotScore({
            statusesCount: author.statusesCount,
            followers: author.followers,
            following: author.following,
            accountAgeDays,
            profilePictureUrl: author.profilePicture,
            description: author.description,
          })
          botScoreCache.set(author.userName, botScore)
        }
        const botScore = botScoreCache.get(author.userName)!

        // Geo result (already resolved above)
        const rawLocation = author.location?.trim()
        const geoResult = rawLocation ? geoCache.get(rawLocation) ?? null : null

        const tweet = enrichRawTweet(raw, query, { geoResult, botScore })

        await putTweet({ ...tweet, source: 'twitter' })
      }),
    )

    // Count successful writes; log individual failures but don't fail the call
    let ingested = 0
    for (const result of writeResults) {
      if (result.status === 'fulfilled') {
        ingested++
      } else {
        console.error('[twitterAdapter.search] putTweet failed:', result.reason)
      }
    }

    return { source: 'twitter', ingested }
  },

  async since(apiKey: string, query: string, _opts?: IngestOpts): Promise<IngestResult> {
    const sinceId = (await getLatestTweetId(query)) ?? undefined
    const rawTweets = await searchTweets(apiKey, query, { sinceId, maxPages: 3 })

    for (const raw of rawTweets) {
      await putTweet({ ...enrichRawTweet(raw, query), source: 'twitter' })
    }

    return { source: 'twitter', ingested: rawTweets.length }
  },
}
