import type { Handler } from "aws-lambda";
import { listTrackedTokens, writeFollowerSnapshot } from "@monorepo-template/core/db/tokens";
import { lookupUser } from "@monorepo-template/core/lib/twitter";

export const handler: Handler = async () => {
  const trackedTokens = await listTrackedTokens();
  const snappedAt = new Date().toISOString();
  const dateStr = snappedAt.slice(0, 10);

  for (const token of trackedTokens) {
    // Use the symbol without $ as username hint (approximate)
    const username = token.sym.replace(/^\$/, "");
    try {
      const user = await lookupUser(username);
      if (!user) continue;
      await writeFollowerSnapshot({
        pk: `FOLLOWER#${user.userName}`,
        sk: `SNAP#${dateStr}`,
        handle: user.userName,
        date: dateStr,
        followers: user.followers,
      });
    } catch (err) {
      console.error(`Follower snapshot failed for ${token.sym}:`, err);
    }
  }
};
