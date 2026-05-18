import type { Handler } from "aws-lambda";
import { getTrackedTokens } from "@monorepo-template/core/db/tokens";
import { searchTweets } from "./lib/twitter.js";
import { putTweet, type Tweet } from "@monorepo-template/core/db/tweets";

export const handler: Handler = async () => {
  let tokens: string[];
  try {
    tokens = await getTrackedTokens();
  } catch {
    tokens = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK"];
  }

  // Re-ingest tweets from the last 24h to refresh engagement counts.
  // Using putTweet (PutCommand with ConditionExpression-less put) overwrites with fresh counts.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const symbol of tokens) {
    try {
      const raw = await searchTweets(symbol, { maxPages: 2 });
      const recent = raw.filter((t) => t.createdAt > oneDayAgo);
      for (const tweet of recent) {
        await putTweet({
          tweetId: tweet.id,
          query: symbol,
          text: tweet.text,
          authorUsername: tweet.author.userName,
          authorId: tweet.author.id,
          authorName: tweet.author.name,
          authorFollowers: tweet.author.followers,
          createdAt: tweet.createdAt,
          likeCount: tweet.likeCount ?? 0,
          retweetCount: tweet.retweetCount ?? 0,
          replyCount: tweet.replyCount ?? 0,
          quoteCount: tweet.quoteCount ?? 0,
          viewCount: tweet.viewCount ?? 0,
          bookmarkCount: tweet.bookmarkCount ?? 0,
          lang: tweet.lang ?? "en",
          isReply: tweet.isReply ?? false,
          hashtags: tweet.entities?.hashtags?.map((h) => h.text) ?? [],
          mentions:
            tweet.entities?.userMentions?.map((m) => m.screenName) ?? [],
          urls:
            tweet.entities?.urls?.map((u) => u.expandedUrl).filter(Boolean) ??
            [],
        });
      }
    } catch (err) {
      console.error(`Engagement snapshot failed for ${symbol}:`, err);
    }
  }
};
