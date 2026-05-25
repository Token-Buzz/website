import type { Handler } from "aws-lambda";
import { lookupUser } from "@monorepo-template/core/lib/twitter";
import { writeFollowerSnapshot } from "@monorepo-template/core/db/tokens";
import { getPollAssignments } from "@monorepo-template/core/db/byok-poll";
import { TWITTER_PROVIDER } from "@monorepo-template/core/db/byok";

// Note: lookupUser swallows errors internally and returns null on any failure
// (including 401/403). Key invalidation is therefore not triggered here — that
// is a known limitation; the searchTweets-based jobs (poller, engagement-snapshot)
// are the authoritative path for marking a key invalid.

export const handler: Handler = async () => {
  const snappedAt = new Date().toISOString();
  const dateStr = snappedAt.slice(0, 10);

  const assignments = await getPollAssignments(TWITTER_PROVIDER);

  for (const { userId, apiKey, queries } of assignments) {
    for (const query of queries) {
      const username = query.replace(/^\$/, "");
      const user = await lookupUser(apiKey, username);
      if (!user) continue;
      try {
        await writeFollowerSnapshot({
          pk: `FOLLOWER#${user.userName}`,
          sk: `SNAP#${dateStr}`,
          handle: user.userName,
          date: dateStr,
          followers: user.followers,
        });
        console.log(`Follower snapshot: ${user.userName} followers=${user.followers} (user ${userId})`);
      } catch (err) {
        console.error(`Follower snapshot write failed for ${query} (user ${userId}):`, err);
      }
    }
  }
};
