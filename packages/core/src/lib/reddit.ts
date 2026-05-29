// Reddit official API client (app-only OAuth2, client_credentials)
// Uses PROJECT credentials from env vars REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.
// Per-user BYOK is NOT used here — Reddit ingestion is project-wide.

import type { RawTweet } from './twitter'

const SEARCH_BASE_URL = 'https://oauth.reddit.com'
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'

export const USER_AGENT = 'web:tokenbuzz:v1.0 (by /u/tokenbuzz)'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

export class RedditApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'RedditApiError'
  }
}

/**
 * Thrown when a user's monthly Reddit quota is exhausted.
 * Defined here (rather than in the adapter) so it can be shared across
 * the client and any adapter/route that catches it.
 */
export class RedditQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RedditQuotaError'
  }
}

// ── OAuth token cache ──────────────────────────────────────────────────────────

type TokenCache = {
  token: string
  expiresAt: number // epoch ms
} | null

let _tokenCache: TokenCache = null

/** Reset the module-level token cache between tests. */
export function __resetTokenCache(): void {
  _tokenCache = null
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new RedditApiError(
      'Missing Reddit credentials: REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set',
      500,
    )
  }

  // Return cached token if it won't expire within the next 60 seconds
  if (_tokenCache && _tokenCache.expiresAt - Date.now() > 60_000) {
    return _tokenCache.token
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new RedditApiError(
      `Reddit token fetch failed: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return _tokenCache.token
}

// ── Reddit API types ──────────────────────────────────────────────────────────

export type RedditPost = {
  id: string
  name: string
  title: string
  selftext: string
  created_utc: number
  score: number
  ups: number
  num_comments: number
  author: string
  subreddit: string
  permalink: string
  url: string
  over_18: boolean
}

type RedditListingResponse = {
  data: {
    children: Array<{ kind: string; data: RedditPost }>
    after: string | null
  }
}

// ── searchPosts ───────────────────────────────────────────────────────────────

/**
 * Searches Reddit posts via the official API.
 * Paginates up to `maxPages` (default 3) using the listing `after` cursor.
 *
 * 4xx → throws RedditApiError immediately (no retry).
 * 5xx / network error → retries with RETRY_DELAYS_MS backoff, then throws.
 * 401 → clears token cache and retries the request once before counting as failure.
 *
 * Returns posts collected and requestCount (number of search HTTP requests made,
 * not counting the token request — for per-call metering).
 */
export async function searchPosts(
  query: string,
  opts: { maxPages?: number; after?: string } = {},
): Promise<{ posts: RedditPost[]; requestCount: number }> {
  const maxPages = opts.maxPages ?? 3

  const allPosts: RedditPost[] = []
  let after: string | null = opts.after ?? null
  let pageCount = 0
  let requestCount = 0

  while (pageCount < maxPages) {
    const url = new URL(`${SEARCH_BASE_URL}/search`)
    url.searchParams.append('q', query)
    url.searchParams.append('sort', 'new')
    url.searchParams.append('limit', '100')
    url.searchParams.append('type', 'link')
    url.searchParams.append('raw_json', '1')
    if (after) {
      url.searchParams.append('after', after)
    }

    let response: Response | undefined
    let tokenRefreshed = false

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const token = await getAccessToken()

      try {
        response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': USER_AGENT,
          },
        })
        requestCount++
      } catch (networkErr) {
        // Network-level failure (DNS, TCP, etc.)
        requestCount++
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
          continue
        }
        throw networkErr
      }

      if (response.ok) {
        break
      }

      // 401 → token may have expired early; clear cache and retry once
      if (response.status === 401 && !tokenRefreshed) {
        _tokenCache = null
        tokenRefreshed = true
        // Don't count against attempt budget — just retry immediately
        // but we need to decrement attempt so the loop increment brings us back
        attempt--
        continue
      }

      // Other 4xx → permanent failure, throw immediately (no retry)
      if (response.status >= 400 && response.status < 500) {
        throw new RedditApiError(
          `Reddit API error: ${response.status} ${response.statusText}`,
          response.status,
        )
      }

      // 5xx → transient; retry if budget remains
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
        continue
      }

      // Retry budget exhausted for 5xx
      throw new RedditApiError(
        `Reddit API error: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    if (!response!.ok) {
      // Should not be reached but satisfies type-narrowing
      throw new RedditApiError(
        `Reddit API error: ${response!.status} ${response!.statusText}`,
        response!.status,
      )
    }

    const data = (await response!.json()) as RedditListingResponse
    const posts = data.data.children
      .filter((child) => child.kind === 't3')
      .map((child) => child.data)

    allPosts.push(...posts)
    pageCount++

    if (!data.data.after) {
      break
    }

    after = data.data.after
  }

  return { posts: allPosts, requestCount }
}

// ── postToRawTweet mapping ────────────────────────────────────────────────────

/**
 * Maps a Reddit post to the RawTweet shape so it can flow through enrichRawTweet.
 */
export function postToRawTweet(post: RedditPost): RawTweet {
  const text = post.selftext ? `${post.title}\n\n${post.selftext}` : post.title

  const externalUrls =
    post.url && !post.url.includes('reddit.com')
      ? [{ expanded_url: post.url }]
      : []

  return {
    id: post.id,
    text,
    createdAt: new Date(post.created_utc * 1000).toISOString(),
    likeCount: post.score ?? post.ups ?? 0,
    retweetCount: 0,
    replyCount: post.num_comments ?? 0,
    quoteCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    conversationId: post.name,
    inReplyToId: undefined,
    author: {
      userName: post.author,
      id: post.author,
      name: post.author,
      isBlueVerified: false,
      followers: 0,
      following: 0,
      statusesCount: 0,
      description: undefined,
    },
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: externalUrls,
    },
  }
}
