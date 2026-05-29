import { searchMessages, messageToRawTweet } from '../lib/discord'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet } from '../db/tweets'
import { DISCORD_PROVIDER } from '../providers'
import type { SourceAdapter, IngestOpts, IngestResult } from './types'

async function ingestDiscord(
  apiKey: string,
  query: string,
  opts: IngestOpts | undefined,
  perChannelLimit: number,
  methodName: string,
): Promise<IngestResult> {
  const messages = await searchMessages(apiKey, query, { perChannelLimit })

  const writeResults = await Promise.allSettled(
    messages.map(async (msg) => {
      const raw = messageToRawTweet(msg)
      const tweet = enrichRawTweet(raw, query, { source: 'discord' })
      await putTweet(tweet)
    }),
  )

  let ingested = 0
  for (const result of writeResults) {
    if (result.status === 'fulfilled') {
      ingested++
    } else {
      console.error(`[discordAdapter.${methodName}] putTweet failed:`, result.reason)
    }
  }

  return { source: 'discord', ingested }
}

export const discordAdapter: SourceAdapter = {
  id: 'discord',
  displayName: 'Discord',
  minPlan: 'free',
  // Conservative cadence — bounded by Discord rate limits, not dollars.
  pollIntervalMs: 15 * 60 * 1000,
  implemented: true,
  byokProvider: DISCORD_PROVIDER,

  async search(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestDiscord(apiKey, query, opts, opts?.maxPages ? opts.maxPages * 25 : 50, 'search')
  },

  async since(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestDiscord(apiKey, query, opts, 25, 'since')
  },
}
