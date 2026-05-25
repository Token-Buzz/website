import type { Handler } from "aws-lambda";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import { enrichRawTweet } from "@monorepo-template/core/lib/enrich";
import { putTweet, getLatestTweetId } from "@monorepo-template/core/db/tweets";
import { getPollAssignments } from "@monorepo-template/core/db/byok-poll";
import { TWITTER_PROVIDER } from "@monorepo-template/core/db/byok";
import { handleKeyError } from "./key-errors";

export const handler: Handler = async () => {
  const assignments = await getPollAssignments(TWITTER_PROVIDER);

  for (const { userId, apiKey, queries } of assignments) {
    for (const query of queries) {
      try {
        const sinceId = (await getLatestTweetId(query)) ?? undefined;
        const rawTweets = await searchTweets(apiKey, query, { sinceId, maxPages: 3 });
        for (const raw of rawTweets) {
          await putTweet(enrichRawTweet(raw, query));
        }
        console.log(`Polled ${rawTweets.length} tweets for ${query} (user ${userId})`);
      } catch (err) {
        if (await handleKeyError(err, userId, TWITTER_PROVIDER)) break;
        console.error(`Poller failed for query ${query} (user ${userId}):`, err);
      }
    }
  }
};
