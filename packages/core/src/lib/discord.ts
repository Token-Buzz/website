// Discord bot client (M9 Phase 5).
//
// Fetch-based Discord REST API v10 client. Discord bots CANNOT do a global
// message search, so search works by iterating the guilds and text channels
// the bot can see. Per-user BYOK: each user supplies their own Discord bot
// token (a single opaque string). Discord is free-tier — no plan gate.

import type { RawTweet } from './twitter'

const API_BASE = 'https://discord.com/api/v10'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

// Maximum wait (ms) for any single sleep — caps Retry-After sleeps so a
// hostile/huge header value can't hang a Lambda.
export let MAX_BACKOFF_MS = 60_000

// ── Sleep seam ───────────────────────────────────────────────────────────────
// All waits in this module go through `sleep()` which delegates to
// `__sleepImpl`. Tests override `__sleepImpl` (or swap it via `__setSleep`)
// to a vi.fn() that resolves immediately so no real time is spent waiting.
export let __sleepImpl: (ms: number) => Promise<void> = (ms) =>
  new Promise<void>((r) => setTimeout(r, ms))

async function sleep(ms: number): Promise<void> {
  return __sleepImpl(ms)
}

/** Replace the sleep implementation (for tests). Returns the previous impl. */
export function __setSleep(fn: (ms: number) => Promise<void>): (ms: number) => Promise<void> {
  const prev = __sleepImpl
  __sleepImpl = fn
  return prev
}

export class DiscordApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'DiscordApiError'
  }
}

// ── Normalised Discord message ────────────────────────────────────────────────

export interface DiscordMessage {
  id: string
  guildId: string
  guildName?: string
  channelId: string
  channelName?: string
  content: string
  timestamp: string
  authorId: string
  authorUsername: string
  authorGlobalName?: string
}

// ── validateToken ─────────────────────────────────────────────────────────────

/**
 * Validates a Discord bot token by probing `GET /users/@me`.
 * Returns `{ ok: true, last4 }` on success (200).
 * Returns `{ ok: false, last4 }` on 401/403 or other 4xx (invalid token).
 * Re-throws `DiscordApiError` on 5xx / network errors so the caller surfaces
 * transient failures rather than silently marking the key invalid.
 *
 * `last4` is the last 4 characters of the token, used for display in the
 * Account UI without exposing the full credential.
 */
export async function validateToken(token: string): Promise<{ ok: boolean; last4: string }> {
  const last4 = token.slice(-4)
  try {
    const response = await fetch(`${API_BASE}/users/@me`, {
      headers: { Authorization: `Bot ${token}` },
    })

    if (response.ok) {
      return { ok: true, last4 }
    }

    if (response.status >= 400 && response.status < 500) {
      return { ok: false, last4 }
    }

    // 5xx
    throw new DiscordApiError(
      `Discord API error: ${response.status} ${response.statusText}`,
      response.status,
    )
  } catch (err) {
    if (err instanceof DiscordApiError) {
      throw err
    }
    // Network-level error — re-throw as DiscordApiError
    throw new DiscordApiError(
      `Discord network error: ${err instanceof Error ? err.message : String(err)}`,
      0,
    )
  }
}

// ── searchMessages ────────────────────────────────────────────────────────────

/**
 * Searches for Discord messages matching `query` across guilds and text
 * channels the bot can see. Returns matching `DiscordMessage[]`.
 *
 * Flow:
 *  1. GET /users/@me/guilds → list of guilds (capped to `maxGuilds`).
 *  2. For each guild: GET /guilds/{id}/channels → text + announcement channels
 *     (type 0 or 5), capped to `maxChannelsPerGuild`.
 *  3. For each channel: GET /channels/{id}/messages?limit=N → recent messages.
 *     Filter those whose content (case-insensitively) contains `query`.
 *
 * Resilience (mirrors telegram's per-channel approach):
 *  - Each channel fetch is wrapped in a bounded retry over RETRY_DELAYS_MS.
 *  - HTTP 429: read Retry-After header (seconds) or body `retry_after`, sleep
 *    min(retryAfter*1000, MAX_BACKOFF_MS) and retry within budget.
 *  - 5xx: back off with RETRY_DELAYS_MS[attempt] and retry.
 *  - 403 or other 4xx on a channel: skip that channel (log) — never let one
 *    channel abort the whole search.
 *  - If a guild's channel-list fetch fails with a permission error, skip the
 *    guild.
 *  - BUT: if the top-level GET /users/@me/guilds returns 401/403, throw
 *    DiscordApiError so the BYOK-invalidation path triggers.
 */
export async function searchMessages(
  token: string,
  query: string,
  opts?: { maxGuilds?: number; perChannelLimit?: number; maxChannelsPerGuild?: number },
): Promise<DiscordMessage[]> {
  const maxGuilds = opts?.maxGuilds ?? 10
  const perChannelLimit = opts?.perChannelLimit ?? 50
  const maxChannelsPerGuild = opts?.maxChannelsPerGuild ?? 20

  // Step 1: Fetch guilds — auth failures here are fatal
  const guildsResp = await fetch(`${API_BASE}/users/@me/guilds`, {
    headers: { Authorization: `Bot ${token}` },
  })

  if (!guildsResp.ok) {
    if (guildsResp.status === 401 || guildsResp.status === 403) {
      throw new DiscordApiError(
        `Discord API error: ${guildsResp.status} ${guildsResp.statusText}`,
        guildsResp.status,
      )
    }
    throw new DiscordApiError(
      `Discord API error fetching guilds: ${guildsResp.status} ${guildsResp.statusText}`,
      guildsResp.status,
    )
  }

  const guilds = (await guildsResp.json()) as Array<{ id: string; name: string }>
  const cappedGuilds = guilds.slice(0, maxGuilds)

  const all: DiscordMessage[] = []

  for (const guild of cappedGuilds) {
    // Step 2: Fetch channels for this guild — skip on permission failures
    let channels: Array<{ id: string; name: string; type: number }>
    try {
      const channelsResp = await fetch(`${API_BASE}/guilds/${guild.id}/channels`, {
        headers: { Authorization: `Bot ${token}` },
      })

      if (!channelsResp.ok) {
        // Permission error → skip guild
        console.warn(
          `[discord] Skipping guild "${guild.name}" (${guild.id}): channels fetch returned ${channelsResp.status}`,
        )
        continue
      }

      const rawChannels = (await channelsResp.json()) as Array<{
        id: string
        name: string
        type: number
      }>

      // Keep only text channels (type 0 = GUILD_TEXT, type 5 = GUILD_ANNOUNCEMENT)
      channels = rawChannels
        .filter((c) => c.type === 0 || c.type === 5)
        .slice(0, maxChannelsPerGuild)
    } catch {
      console.warn(`[discord] Skipping guild "${guild.name}" (${guild.id}): channel fetch error`)
      continue
    }

    // Step 3: Fetch messages per channel with bounded retry + skip-on-failure
    for (const channel of channels) {
      let succeeded = false

      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        let resp: Response
        try {
          resp = await fetch(
            `${API_BASE}/channels/${channel.id}/messages?limit=${perChannelLimit}`,
            { headers: { Authorization: `Bot ${token}` } },
          )
        } catch {
          // Network-level failure
          if (attempt < RETRY_DELAYS_MS.length) {
            await sleep(RETRY_DELAYS_MS[attempt])
            continue
          }
          console.error(
            `[discord] Skipping channel "${channel.name}" (${channel.id}) in guild "${guild.name}": network error after retries`,
          )
          break
        }

        if (resp.ok) {
          const messages = (await resp.json()) as Array<{
            id: string
            content: string
            timestamp: string
            author: { id: string; username: string; global_name?: string }
          }>

          const lowerQuery = query.toLowerCase()
          for (const msg of messages) {
            if (
              typeof msg.content === 'string' &&
              msg.content.length > 0 &&
              msg.content.toLowerCase().includes(lowerQuery)
            ) {
              all.push({
                id: msg.id,
                guildId: guild.id,
                guildName: guild.name,
                channelId: channel.id,
                channelName: channel.name,
                content: msg.content,
                timestamp: msg.timestamp,
                authorId: msg.author.id,
                authorUsername: msg.author.username,
                authorGlobalName: msg.author.global_name,
              })
            }
          }

          succeeded = true
          break
        }

        // 429 → Rate limited
        if (resp.status === 429) {
          if (attempt < RETRY_DELAYS_MS.length) {
            let retryAfterMs: number

            // Try Retry-After header first
            const retryAfterHeader = resp.headers.get('Retry-After')
            if (retryAfterHeader !== null) {
              const retryAfterSec = parseFloat(retryAfterHeader)
              retryAfterMs = !isNaN(retryAfterSec)
                ? Math.min(retryAfterSec * 1000, MAX_BACKOFF_MS)
                : RETRY_DELAYS_MS[attempt]
            } else {
              // Fall back to JSON body retry_after (Discord sometimes uses this)
              try {
                const body = (await resp.json()) as { retry_after?: number }
                const retryAfterSec = body.retry_after
                retryAfterMs =
                  typeof retryAfterSec === 'number'
                    ? Math.min(retryAfterSec * 1000, MAX_BACKOFF_MS)
                    : RETRY_DELAYS_MS[attempt]
              } catch {
                retryAfterMs = RETRY_DELAYS_MS[attempt]
              }
            }

            await sleep(retryAfterMs)
            continue
          }
          // Retry budget exhausted for this channel
          console.error(
            `[discord] Skipping channel "${channel.name}" (${channel.id}) in guild "${guild.name}": 429 after retries`,
          )
          break
        }

        // 403 or other 4xx → skip channel
        if (resp.status >= 400 && resp.status < 500) {
          console.warn(
            `[discord] Skipping channel "${channel.name}" (${channel.id}) in guild "${guild.name}": HTTP ${resp.status}`,
          )
          break
        }

        // 5xx → retry
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt])
          continue
        }

        // Retry budget exhausted for this channel
        console.error(
          `[discord] Skipping channel "${channel.name}" (${channel.id}) in guild "${guild.name}": HTTP ${resp.status} after retries`,
        )
        break
      }

      // succeeded is only used to track whether we broke out cleanly — the
      // messages were already pushed inside the loop. Suppress unused warning.
      void succeeded
    }
  }

  return all
}

// ── messageToRawTweet ─────────────────────────────────────────────────────────

/**
 * Maps a normalised DiscordMessage to the RawTweet shape so it can flow
 * through enrichRawTweet. Discord message ids are globally-unique snowflakes,
 * so the id is passed through directly.
 */
export function messageToRawTweet(msg: DiscordMessage): RawTweet {
  return {
    id: msg.id,
    text: msg.content,
    createdAt: msg.timestamp,
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    quoteCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    author: {
      userName: msg.authorUsername,
      id: msg.authorId,
      name: msg.authorGlobalName ?? msg.authorUsername,
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
