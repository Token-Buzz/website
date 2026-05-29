// Telegram client lib (M9 Phase 4).
//
// Wraps MTProto (a project-owned *user* account acting as a bot) via GramJS.
// The GramJS SDK is kept fully isolated behind an injectable client factory so
// the pure mapper + the retry/aggregation logic in `searchMessages` are
// unit-testable without ever opening a real MTProto connection.
//
// Cadence here is bounded by Telegram's platform rate limits / FLOOD_WAIT, not
// by per-call dollars (Telegram is free). Telegram is Alpha-gated.

import type { RawTweet } from './twitter'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

// ── Sleep seam ───────────────────────────────────────────────────────────────
// All backoff waits go through `_sleep`. Tests swap it via `__setSleep` to a
// no-op so no real time is spent waiting.
let _sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Replace the sleep implementation (for tests). Returns the previous impl. */
export function __setSleep(fn: (ms: number) => Promise<void>): (ms: number) => Promise<void> {
  const prev = _sleep
  _sleep = fn
  return prev
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly floodWaitSeconds?: number,
  ) {
    super(message)
    this.name = 'TelegramApiError'
  }
}

// ── Curated channels ───────────────────────────────────────────────────────────
// The well-known public crypto Telegram channels the project-owned account
// joins/observes. This is a sensible default seed; the real, fuller curated
// list lives in the account configuration and can override this via opts.channels.
export const CRYPTO_CHANNELS: string[] = [
  'binance',
  'CryptoComOfficial',
  'whale_alert_io',
  'CoinMarketCap',
  'CoinDeskGlobal',
  'cointelegraph',
  'WatcherGuru',
  'TheCryptoApp',
  'crypto',
  'kucoin_news',
]

// ── Normalised Telegram message ────────────────────────────────────────────────

export interface TelegramMessage {
  id: number
  channel: string
  channelTitle?: string
  text: string
  /** Unix seconds. */
  date: number
  views: number
  forwards: number
  replies: number
  senderId?: string
  senderUsername?: string
  senderName?: string
}

// ── messageToRawTweet (pure) ────────────────────────────────────────────────────

/**
 * Maps a normalised Telegram message to the RawTweet shape so it can flow
 * through enrichRawTweet. The id is composed as `${channel}:${id}` so it is
 * unique across channels (message ids are only unique within a channel).
 */
export function messageToRawTweet(msg: TelegramMessage): RawTweet {
  return {
    id: `${msg.channel}:${msg.id}`,
    text: msg.text,
    createdAt: new Date(msg.date * 1000).toISOString(),
    likeCount: 0,
    retweetCount: msg.forwards ?? 0,
    replyCount: msg.replies ?? 0,
    quoteCount: 0,
    viewCount: msg.views ?? 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    author: {
      userName: msg.senderUsername ?? msg.channel,
      id: msg.senderId ?? msg.channel,
      name: msg.senderName ?? msg.channelTitle ?? msg.channel,
      isBlueVerified: false,
      followers: 0,
      following: 0,
      statusesCount: 0,
    },
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: [],
    },
  }
}

// ── GramJS client seam ───────────────────────────────────────────────────────────
// Minimal interface so tests can inject a fake client without touching GramJS.
// The real TelegramClient.getMessages matches this shape.
export interface TgClient {
  getMessages(channel: string, params: { search: string; limit: number }): Promise<unknown[]>
}

let _cachedClient: TgClient | null = null

/** Reset the cached client (for tests). */
export function __resetClient(): void {
  _cachedClient = null
}

async function defaultClientFactory(): Promise<TgClient> {
  if (_cachedClient) return _cachedClient

  const apiId = process.env.TELEGRAM_API_ID
  const apiHash = process.env.TELEGRAM_API_HASH
  const session = process.env.TELEGRAM_SESSION

  if (!apiId || !apiHash || !session) {
    throw new TelegramApiError('TELEGRAM_SESSION is not configured', 500)
  }

  // Lazy import so the (heavy, Node-only) GramJS SDK is only loaded when a real
  // connection is actually needed — never in unit tests (which inject a fake).
  const { TelegramClient } = await import('telegram')
  const { StringSession } = await import('telegram/sessions')

  const client = new TelegramClient(
    new StringSession(session),
    Number(apiId),
    apiHash,
    { connectionRetries: 5 },
  )
  await client.connect()

  // TelegramClient.getMessages is structurally compatible with TgClient.
  _cachedClient = client as unknown as TgClient
  return _cachedClient
}

let _clientFactory: () => Promise<TgClient> = defaultClientFactory

/** Inject a client factory (for tests). */
export function __setClientFactory(fn: () => Promise<TgClient>): void {
  _clientFactory = fn
}

/** Restore the default (real GramJS) client factory. */
export function __resetClientFactory(): void {
  _clientFactory = defaultClientFactory
  _cachedClient = null
}

// ── FloodWait detection ─────────────────────────────────────────────────────────
// Robust check that works for the real GramJS FloodWaitError as well as a plain
// fake error object simulated by tests (no need for the real class).
function isFloodWait(err: unknown): err is { seconds: number } {
  if (!err || typeof err !== 'object') return false
  const e = err as { constructor?: { name?: string }; seconds?: unknown }
  return e.constructor?.name === 'FloodWaitError' || typeof e.seconds === 'number'
}

// ── searchMessages ──────────────────────────────────────────────────────────────

/**
 * Searches public crypto channels for `query`, aggregating matching messages
 * across all channels. Reads project MTProto credentials from env.
 *
 * Per channel: bounded retry over `client.getMessages`.
 *  - FLOOD_WAIT (small, ≤ 60s): sleep that long and retry the channel once.
 *  - FLOOD_WAIT (large, > 60s): skip the channel (logged) — never let one
 *    channel's flood-wait abort the whole search.
 *  - Other transient errors: retried with RETRY_DELAYS_MS backoff; exhausting
 *    the budget throws TelegramApiError.
 */
export async function searchMessages(
  query: string,
  opts?: { channels?: string[]; perChannelLimit?: number },
): Promise<TelegramMessage[]> {
  const apiId = process.env.TELEGRAM_API_ID
  const apiHash = process.env.TELEGRAM_API_HASH
  const session = process.env.TELEGRAM_SESSION
  if (!apiId || !apiHash || !session) {
    throw new TelegramApiError('TELEGRAM_SESSION is not configured', 500)
  }

  const client = await _clientFactory()
  const channels = opts?.channels ?? CRYPTO_CHANNELS
  const limit = opts?.perChannelLimit ?? 50

  const all: TelegramMessage[] = []

  for (const channel of channels) {
    let floodRetried = false

    // Bounded retry per channel.
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        // GramJS messages are loosely typed; treat as any inside this fn only.
        const raw = (await client.getMessages(channel, {
          search: query,
          limit,
        })) as any[]

        for (const m of raw ?? []) {
          const text: string | undefined = m?.message ?? m?.text
          if (!text) continue // skip messages with empty/undefined text

          all.push({
            id: Number(m?.id ?? 0),
            channel,
            channelTitle: m?.chat?.title ?? m?.channelTitle,
            text,
            date: Number(m?.date ?? 0),
            views: m?.views ?? 0,
            forwards: m?.forwards ?? 0,
            replies: m?.replies?.replies ?? 0,
            senderId:
              m?.senderId != null ? String(m.senderId) : m?.fromId != null ? String(m.fromId) : undefined,
            senderUsername: m?.sender?.username ?? undefined,
            senderName:
              m?.sender?.firstName != null || m?.sender?.lastName != null
                ? [m?.sender?.firstName, m?.sender?.lastName].filter(Boolean).join(' ')
                : undefined,
          })
        }

        break // channel done
      } catch (err) {
        // FLOOD_WAIT handling — bounded by platform rate limits, not dollars.
        if (isFloodWait(err)) {
          const seconds = (err as { seconds: number }).seconds
          if (seconds <= 60 && !floodRetried) {
            floodRetried = true
            await _sleep(seconds * 1000)
            attempt-- // retry this channel without consuming the transient budget
            continue
          }
          // Large flood-wait (or already retried) → skip this channel.
          console.error(
            `[telegram] FLOOD_WAIT ${seconds}s on channel "${channel}"; skipping`,
          )
          break
        }

        // Other transient error → retry within RETRY_DELAYS_MS budget.
        if (attempt < RETRY_DELAYS_MS.length) {
          await _sleep(RETRY_DELAYS_MS[attempt])
          continue
        }

        // Retry budget exhausted.
        throw new TelegramApiError(
          `Telegram getMessages failed for channel "${channel}": ${
            err instanceof Error ? err.message : String(err)
          }`,
          500,
        )
      }
    }
  }

  return all
}
