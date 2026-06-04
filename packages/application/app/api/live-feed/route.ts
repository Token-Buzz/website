import { requireUserId } from "@/app/_auth/requireUserId";
import {
  getRecentTweetsByQuery,
  type TweetRecord,
} from "@monorepo-template/core/db/tweets";
import { getAllTrackedQueries } from "@monorepo-template/core/db/user-data";
import {
  mergeLiveFeed,
  type LiveFeedSentiment,
} from "@monorepo-template/core/live-feed";

const VALID_SENTIMENTS: ReadonlySet<string> = new Set<LiveFeedSentiment>([
  "bull",
  "bear",
  "neu",
]);

function parseSentiment(raw: string | null): LiveFeedSentiment | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return VALID_SENTIMENTS.has(lower) ? (lower as LiveFeedSentiment) : undefined;
}

/** The item shape returned by the live-feed API. */
interface LiveFeedTweet {
  tweetId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | undefined;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  tokenTags: string[];
  sentiment: string | undefined;
}

/**
 * Cast a TweetRecord (stale type) to the richer shape that putTweet actually
 * writes. All fields beyond the legacy TweetRecord fields are accessed via the
 * cast so TypeScript won't complain.
 */
type RichTweet = TweetRecord & {
  tweetId?: string;
  authorName?: string;
  authorUsername?: string;
  authorProfilePicture?: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  query?: string;
  // sentiment is written by updateTweetSentiment; sent is the old TweetRecord field
  sentiment?: string;
};

function toRich(record: TweetRecord): RichTweet {
  return record as RichTweet;
}

function mapTweet(record: TweetRecord): LiveFeedTweet {
  const r = toRich(record);
  return {
    tweetId: r.tweetId ?? r.id ?? "",
    authorName: r.authorName ?? r.handle ?? "",
    authorUsername: r.authorUsername ?? r.handle ?? "",
    authorAvatar: r.authorProfilePicture ?? undefined,
    text: r.text ?? "",
    createdAt: r.createdAt ?? r.timestamp ?? "",
    likeCount: r.likeCount ?? r.likes ?? 0,
    retweetCount: r.retweetCount ?? r.retweets ?? 0,
    replyCount: r.replyCount ?? r.replies ?? 0,
    viewCount: r.viewCount ?? 0,
    tokenTags: r.query ? [r.query] : r.symbol ? [r.symbol] : [],
    sentiment: r.sentiment ?? r.sent ?? undefined,
  };
}

/**
 * A minimal LiveFeedItem-compatible view of a TweetRecord used for the merge.
 * mergeLiveFeed needs tweetId + createdAt.
 */
interface TweetFeedItem {
  tweetId: string;
  createdAt: string;
  _record: TweetRecord;
}

function toFeedItem(record: TweetRecord): TweetFeedItem {
  const r = toRich(record);
  return {
    tweetId: r.tweetId ?? r.id ?? "",
    createdAt: r.createdAt ?? r.timestamp ?? "",
    _record: record,
  };
}

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Parse and clamp limit.
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "30", 10),
    100,
  );

  // Decode opaque base64 cursor → raw sort-key string.
  const cursorParam = searchParams.get("cursor");
  const decodedCursor = cursorParam
    ? Buffer.from(cursorParam, "base64").toString()
    : undefined;

  // Optional sentiment filter.
  const sentiment = parseSentiment(searchParams.get("sentiment"));

  // If a token deep-link filter is present, use only that token.
  const tokenFilter = searchParams.get("token");

  // Fetch tracked queries (skipped when a token filter overrides).
  const queries = tokenFilter
    ? [tokenFilter]
    : await getAllTrackedQueries(userId);

  if (queries.length === 0) {
    return Response.json({ tweets: [], cursor: undefined });
  }

  // Fan out: one GSI query per tracked query.
  const pages = await Promise.all(
    queries.map((q) =>
      getRecentTweetsByQuery(q, { before: decodedCursor, limit }),
    ),
  );

  // Apply sentiment filter before merging (avoids polluting the merge result).
  const filteredPages = sentiment
    ? pages.map((page) =>
        page.filter((record) => {
          const r = toRich(record);
          return (r.sentiment ?? r.sent) === sentiment;
        }),
      )
    : pages;

  // Convert to TweetFeedItem[] so mergeLiveFeed can sort/dedupe.
  const feedPages: TweetFeedItem[][] = filteredPages.map((page) =>
    page.map(toFeedItem),
  );

  const { tweets: feedItems, nextCursorSk } = mergeLiveFeed(feedPages, limit);

  // Map back to the response shape.
  const tweets: LiveFeedTweet[] = feedItems.map((item) =>
    mapTweet(item._record),
  );

  return Response.json({
    tweets,
    cursor: nextCursorSk
      ? Buffer.from(nextCursorSk).toString("base64")
      : undefined,
  });
}
