import { searchMessages, messageToRawTweet } from '../lib/telegram'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet } from '../db/tweets'
import type { SourceAdapter, IngestOpts, IngestResult } from './types'

async function ingestTelegram(
  query: string,
  _opts: IngestOpts | undefined,
  perChannelLimit: number,
  methodName: string,
): Promise<IngestResult> {
  const messages = await searchMessages(query, { perChannelLimit })

  const writeResults = await Promise.allSettled(
    messages.map(async (msg) => {
      const raw = messageToRawTweet(msg)
      const tweet = enrichRawTweet(raw, query, { source: 'telegram' })
      await putTweet(tweet)
    }),
  )

  let ingested = 0
  for (const result of writeResults) {
    if (result.status === 'fulfilled') {
      ingested++
    } else {
      console.error(`[telegramAdapter.${methodName}] putTweet failed:`, result.reason)
    }
  }

  return { source: 'telegram', ingested }
}

export const telegramAdapter: SourceAdapter = {
  id: 'telegram',
  displayName: 'Telegram',
  minPlan: 'alpha',
  // Conservative cadence — bounded by Telegram rate limits / FLOOD_WAIT, not dollars.
  pollIntervalMs: 15 * 60 * 1000,
  implemented: true,
  byokProvider: null,

  // Telegram is free and Alpha (unlimited) — no per-user metering/quota.
  async search(_apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestTelegram(query, opts, opts?.maxPages ? opts.maxPages * 25 : 50, 'search')
  },

  async since(_apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
    return ingestTelegram(query, opts, 25, 'since')
  },
}
