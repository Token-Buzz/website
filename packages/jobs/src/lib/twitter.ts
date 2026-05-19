// twitterapi.io advanced search client

const BASE_URL = "https://api.twitterapi.io";

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
  author: TwitterAuthor;
  entities?: {
    hashtags?: Array<{ text: string }>;
    userMentions?: Array<{ screenName: string }>;
    urls?: Array<{ expandedUrl: string }>;
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
  query: string,
  opts: { sinceId?: string; maxPages?: number; queryType?: string }
): Promise<RawTweet[]> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) {
    throw new Error("TWITTER_API_KEY environment variable not set");
  }

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

    const response = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey },
    });
    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as SearchResponse;
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
export async function lookupUser(username: string): Promise<TwitterAuthor | null> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) {
    throw new Error("TWITTER_API_KEY environment variable not set");
  }

  const url = new URL(`${BASE_URL}/twitter/user/info`);
  url.searchParams.append("username", username);

  try {
    const response = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey },
    });
    if (!response.ok) {
      return null;
    }

    const user = (await response.json()) as TwitterAuthor;
    return user;
  } catch {
    return null;
  }
}
