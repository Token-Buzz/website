import type { Handler } from "aws-lambda";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import { putTweet } from "@monorepo-template/core/db/tweets";

export const handler: Handler = async () => {
  let tokens: string[];
  try {
    const trackedTokens = await listTrackedTokens();
    tokens = trackedTokens.map((t) => t.sym);
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
          authorProfilePicture: tweet.author.profilePicture,
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
            tweet.entities?.user_mentions?.map((m) => m.screen_name) ?? [],
          urls:
            tweet.entities?.urls?.map((u) => u.expanded_url).filter(Boolean) ??
            [],
        });
      }
    } catch (err) {
      console.error(`Engagement snapshot failed for ${symbol}:`, err);
    }
  }
};
