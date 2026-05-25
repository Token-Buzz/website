// twitterapi.io advanced search client

const BASE_URL = "https://api.twitterapi.io";

// Used to probe whether an API key is valid — a stable, well-known handle.
const VALIDATION_HANDLE = "elonmusk";

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500];

export class TwitterApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "TwitterApiError";
  }
}

export type TwitterAuthor = {
  userName: string;
  id: string;
  name: string;
  isBlueVerified: boolean;
  profilePicture?: string;
  followers: number;
  following: number;
  description?: string;
  statusesCount: number;
  // Analytics extension fields: twitterapi.io may not always populate these
  createdAt?: string;
  isAutomated?: boolean;
  verifiedType?: string;
  mediaCount?: number;
  favouritesCount?: number;
  location?: string;
};

export type RawTweet = {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
  lang: string;
  isReply: boolean;
  conversationId?: string;
  inReplyToId?: string;
  author: TwitterAuthor;
  entities?: {
    hashtags?: Array<{ text: string }>;
    // twitterapi.io returns snake_case inside entities
    user_mentions?: Array<{ screen_name: string }>;
    urls?: Array<{ expanded_url: string }>;
  };
};

export type SearchResponse = {
  tweets: RawTweet[];
  has_next_page: boolean;
  next_cursor: string | null;
};

// Calls twitterapi.io advanced search. Returns up to maxPages pages of results.
// If sinceId is provided, appends since_id:<sinceId> to the query.
export async function searchTweets(
  apiKey: string,
  query: string,
  opts: { sinceId?: string; maxPages?: number; queryType?: string }
): Promise<RawTweet[]> {
  const maxPages = opts.maxPages ?? 5;
  const queryType = opts.queryType ?? "Latest";

  let q = query;
  if (opts.sinceId) {
    q = `${query} since_id:${opts.sinceId}`;
  }

  const allTweets: RawTweet[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const url = new URL(`${BASE_URL}/twitter/tweet/advanced_search`);
    url.searchParams.append("query", q);
    url.searchParams.append("queryType", queryType);
    if (cursor) {
      url.searchParams.append("cursor", cursor);
    }

    // Bounded retry: up to 2 retries (3 total attempts) for transient failures.
    // 4xx errors are permanent — throw immediately without retrying.
    let response: Response | undefined;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        response = await fetch(url.toString(), {
          headers: { "X-API-Key": apiKey },
        });
      } catch (networkErr) {
        // Network-level failure (DNS, TCP, etc.)
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
          );
          continue;
        }
        throw networkErr;
      }

      if (response.ok) {
        break;
      }

      // 4xx → permanent failure, throw immediately (no retry)
      if (response.status >= 400 && response.status < 500) {
        throw new TwitterApiError(
          `Twitter API error: ${response.status} ${response.statusText}`,
          response.status,
        );
      }

      // 5xx → transient; retry if budget remains
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        );
        continue;
      }

      // Retry budget exhausted for 5xx
      throw new TwitterApiError(
        `Twitter API error: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    if (!response!.ok) {
      // Should not be reached but satisfies type-narrowing
      throw new TwitterApiError(
        `Twitter API error: ${response!.status} ${response!.statusText}`,
        response!.status,
      );
    }

    const data = (await response!.json()) as SearchResponse;
    allTweets.push(...data.tweets);
    pageCount++;

    if (!data.has_next_page || !data.next_cursor) {
      break;
    }

    cursor = data.next_cursor;
  }

  return allTweets;
}

// Looks up a Twitter user by username.
export async function lookupUser(apiKey: string, username: string): Promise<TwitterAuthor | null> {
  const url = new URL(`${BASE_URL}/twitter/user/info`);
  url.searchParams.append("userName", username);

  try {
    const response = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey },
    });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { status?: string; msg?: string; data?: TwitterAuthor };
    if (!body?.data?.userName) {
      return null;
    }
    return body.data;
  } catch {
    return null;
  }
}

// Validates an API key by probing a known-stable handle.
// Returns ok=true if the probe succeeds, plus the last 4 chars of the key for display.
export async function validateKey(apiKey: string): Promise<{ ok: boolean; last4: string }> {
  const last4 = apiKey.slice(-4);
  const user = await lookupUser(apiKey, VALIDATION_HANDLE);
  return { ok: user !== null, last4 };
}
