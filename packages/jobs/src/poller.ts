import type { Handler } from "aws-lambda";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import {
  putTweet,
  getLatestTweetId,
  type Tweet,
} from "@monorepo-template/core/db/tweets";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";

export const handler: Handler = async () => {
  // Get all queries to poll. Start with tracked tokens as queries.
  // Fall back to a default list if none configured.
  let queries: string[];
  try {
    const trackedTokens = await listTrackedTokens();
    queries = trackedTokens.map((t) => t.sym);
  } catch {
    queries = [];
  }
  if (queries.length === 0) {
    queries = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];
  }

  for (const query of queries) {
    try {
      const sinceId = (await getLatestTweetId(query)) ?? undefined;
      const rawTweets = await searchTweets(query, { sinceId, maxPages: 3 });
      for (const raw of rawTweets) {
        const tweet: Tweet = {
          tweetId: raw.id,
          query,
          text: raw.text,
          authorUsername: raw.author.userName,
          authorId: raw.author.id,
          authorName: raw.author.name,
          authorFollowers: raw.author.followers,
          authorProfilePicture: raw.author.profilePicture,
          createdAt: raw.createdAt,
          likeCount: raw.likeCount ?? 0,
          retweetCount: raw.retweetCount ?? 0,
          replyCount: raw.replyCount ?? 0,
          quoteCount: raw.quoteCount ?? 0,
          viewCount: raw.viewCount ?? 0,
          bookmarkCount: raw.bookmarkCount ?? 0,
          lang: raw.lang ?? "en",
          isReply: raw.isReply ?? false,
          hashtags: raw.entities?.hashtags?.map((h) => h.text) ?? [],
          mentions:
            raw.entities?.userMentions?.map((m) => m.screenName) ?? [],
          urls:
            raw.entities?.urls?.map((u) => u.expandedUrl).filter(Boolean) ??
            [],
        };
        await putTweet(tweet);
      }
      console.log(`Polled ${rawTweets.length} tweets for ${query}`);
    } catch (err) {
      console.error(`Poller failed for query ${query}:`, err);
    }
  }
};
