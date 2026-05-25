import type { Handler } from "aws-lambda";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import { enrichRawTweet } from "@monorepo-template/core/lib/enrich";
import { putTweet } from "@monorepo-template/core/db/tweets";
import { getPollAssignments } from "@monorepo-template/core/db/byok-poll";
import { TWITTER_PROVIDER } from "@monorepo-template/core/db/byok";
import { handleKeyError } from "./key-errors";

export const handler: Handler = async () => {
  // Re-ingest tweets from the last 24h to refresh engagement counts.
  // Using putTweet (PutCommand) overwrites the stored record with fresh counts.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const assignments = await getPollAssignments(TWITTER_PROVIDER);

  for (const { userId, apiKey, queries } of assignments) {
    for (const query of queries) {
      try {
        const raw = await searchTweets(apiKey, query, { maxPages: 2 });
        const recent = raw.filter((t) => t.createdAt > oneDayAgo);
        for (const tweet of recent) {
          await putTweet(enrichRawTweet(tweet, query));
        }
        console.log(`Engagement snapshot: ${recent.length} tweets for ${query} (user ${userId})`);
      } catch (err) {
        if (await handleKeyError(err, userId, TWITTER_PROVIDER)) break;
        console.error(`Engagement snapshot failed for query ${query} (user ${userId}):`, err);
      }
    }
  }
};
