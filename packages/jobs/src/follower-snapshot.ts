import type { Handler } from "aws-lambda";
import { getTrackedTokens } from "@monorepo-template/core/db/tokens";
import { writeFollowerSnapshot } from "@monorepo-template/core/db/tokens";
import { lookupUser } from "./lib/twitter.js";

export const handler: Handler = async () => {
  const tokens = await getTrackedTokens();
  const snappedAt = new Date().toISOString();

  for (const symbol of tokens) {
    // Use the symbol without $ as username hint (approximate)
    const username = symbol.replace(/^\$/, "");
    try {
      const user = await lookupUser(username);
      if (!user) continue;
      await writeFollowerSnapshot({
        symbol,
        authorUsername: user.userName,
        followers: user.followers,
        following: user.following,
        snappedAt,
      });
    } catch (err) {
      console.error(`Follower snapshot failed for ${symbol}:`, err);
    }
  }
};
