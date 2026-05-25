import type { Handler } from "aws-lambda";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import { enrichRawTweet } from "@monorepo-template/core/lib/enrich";
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

  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) throw new Error("TWITTER_API_KEY environment variable not set");

  for (const symbol of tokens) {
    try {
      const raw = await searchTweets(apiKey, symbol, { maxPages: 2 });
      const recent = raw.filter((t) => t.createdAt > oneDayAgo);
      for (const tweet of recent) {
        await putTweet(enrichRawTweet(tweet, symbol));
      }
    } catch (err) {
      console.error(`Engagement snapshot failed for ${symbol}:`, err);
    }
  }
};
