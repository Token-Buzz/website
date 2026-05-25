import type { Handler } from "aws-lambda";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import { enrichRawTweet } from "@monorepo-template/core/lib/enrich";
import {
  putTweet,
  getLatestTweetId,
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

  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) throw new Error("TWITTER_API_KEY environment variable not set");

  for (const query of queries) {
    try {
      const sinceId = (await getLatestTweetId(query)) ?? undefined;
      const rawTweets = await searchTweets(apiKey, query, { sinceId, maxPages: 3 });
      for (const raw of rawTweets) {
        await putTweet(enrichRawTweet(raw, query));
      }
      console.log(`Polled ${rawTweets.length} tweets for ${query}`);
    } catch (err) {
      console.error(`Poller failed for query ${query}:`, err);
    }
  }
};
