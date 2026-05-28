// Neynar (Farcaster) API client

const BASE_URL = 'https://api.neynar.com/v2'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

export class FarcasterApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'FarcasterApiError'
  }
}

// ── Neynar response types ─────────────────────────────────────────────────────

export type NeynarCastAuthor = {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  follower_count: number
  following_count: number
  profile?: {
    bio?: {
      text?: string
    }
  }
}

export type NeynarCast = {
  hash: string
  text: string
  timestamp: string
  parent_hash: string | null
  thread_hash: string
  author: NeynarCastAuthor
  reactions: {
    likes_count: number
    recasts_count: number
  }
  replies: {
    count: number
  }
  mentioned_profiles?: Array<{ username: string }>
  embeds?: Array<{ url?: string }>
}

type NeynarSearchResponse = {
  result: {
    casts: NeynarCast[]
    next: {
      cursor: string | null
    }
  }
}

// ── Cast search ───────────────────────────────────────────────────────────────

/**
 * Searches Farcaster casts via Neynar. Paginates up to `maxPages` (default 5).
 * 4xx → throws FarcasterApiError immediately (no retry).
 * 5xx / network error → retries with RETRY_DELAYS_MS backoff, then throws.
 */
export async function searchCasts(
  apiKey: string,
  query: string,
  opts: { maxPages?: number; cursor?: string } = {},
): Promise<NeynarCast[]> {
  const maxPages = opts.maxPages ?? 5

  const allCasts: NeynarCast[] = []
  let cursor: string | null = opts.cursor ?? null
  let pageCount = 0

  while (pageCount < maxPages) {
    const url = new URL(`${BASE_URL}/farcaster/cast/search`)
    url.searchParams.append('q', query)
    url.searchParams.append('limit', '25')
    if (cursor) {
      url.searchParams.append('cursor', cursor)
    }

    // Bounded retry: up to 2 retries (3 total attempts) for transient failures.
    // 4xx errors are permanent — throw immediately without retrying.
    let response: Response | undefined
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        response = await fetch(url.toString(), {
          headers: { 'x-api-key': apiKey },
        })
      } catch (networkErr) {
        // Network-level failure (DNS, TCP, etc.)
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
          )
          continue
        }
        throw networkErr
      }

      if (response.ok) {
        break
      }

      // 4xx → permanent failure, throw immediately (no retry)
      if (response.status >= 400 && response.status < 500) {
        throw new FarcasterApiError(
          `Neynar API error: ${response.status} ${response.statusText}`,
          response.status,
        )
      }

      // 5xx → transient; retry if budget remains
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        )
        continue
      }

      // Retry budget exhausted for 5xx
      throw new FarcasterApiError(
        `Neynar API error: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    if (!response!.ok) {
      // Should not be reached but satisfies type-narrowing
      throw new FarcasterApiError(
        `Neynar API error: ${response!.status} ${response!.statusText}`,
        response!.status,
      )
    }

    const data = (await response!.json()) as NeynarSearchResponse
    allCasts.push(...data.result.casts)
    pageCount++

    if (!data.result.next?.cursor) {
      break
    }

    cursor = data.result.next.cursor
  }

  return allCasts
}

// ── Cast → RawTweet mapping ───────────────────────────────────────────────────

import type { RawTweet } from './twitter'

/**
 * Maps a Neynar cast to the RawTweet shape so it can flow through enrichRawTweet.
 */
export function castToRawTweet(cast: NeynarCast): RawTweet {
  return {
    id: cast.hash,
    text: cast.text,
    createdAt: cast.timestamp,
    likeCount: cast.reactions?.likes_count ?? 0,
    retweetCount: cast.reactions?.recasts_count ?? 0,
    replyCount: cast.replies?.count ?? 0,
    quoteCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: !!cast.parent_hash,
    conversationId: cast.thread_hash,
    inReplyToId: cast.parent_hash ?? undefined,
    author: {
      userName: cast.author.username,
      id: String(cast.author.fid),
      name: cast.author.display_name,
      isBlueVerified: false,
      profilePicture: cast.author.pfp_url,
      followers: cast.author.follower_count ?? 0,
      following: cast.author.following_count ?? 0,
      description: cast.author.profile?.bio?.text,
      statusesCount: 0,
    },
    entities: {
      hashtags: [],
      user_mentions: (cast.mentioned_profiles ?? []).map((p) => ({
        screen_name: p.username,
      })),
      urls: (cast.embeds ?? [])
        .filter((e) => e.url)
        .map((e) => ({ expanded_url: e.url! })),
    },
  }
}
