import type { Handler } from "aws-lambda";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";
import {
  getSentiment,
  writeDailyRollup,
} from "@monorepo-template/core/db/aggregates";

export const handler: Handler = async () => {
  let tokens: string[];
  try {
    const trackedTokens = await listTrackedTokens();
    tokens = trackedTokens.map((t) => t.sym);
  } catch {
    tokens = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];
  }

  // Yesterday's date
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayBucket = yesterday.toISOString().slice(0, 10); // "2025-05-15"

  for (const symbol of tokens) {
    try {
      const hourly = await getSentiment(symbol, "24H");
      // Filter to yesterday's rows only
      const yesterdayRows = hourly.filter((h) =>
        h.bucket?.startsWith(dayBucket)
      );
      if (yesterdayRows.length === 0) continue;

      let bullCount = 0;
      let neutralCount = 0;
      let bearCount = 0;
      let totalScore = 0;
      let tweetCount = 0;

      for (const h of yesterdayRows) {
        bullCount += h.bull ?? 0;
        neutralCount += h.neu ?? 0;
        bearCount += h.bear ?? 0;
        totalScore += h.score ?? 0;
        tweetCount += h.count ?? 0;
      }

      const avgScore =
        tweetCount > 0
          ? Math.round(totalScore / tweetCount)
          : 0;

      await writeDailyRollup(symbol, dayBucket, {
        bullCount,
        neutralCount,
        bearCount,
        totalScore,
        tweetCount,
        avgScore,
        hourlyCount: yesterdayRows.length,
      });
    } catch (err) {
      console.error(`Daily rollup failed for ${symbol}:`, err);
    }
  }
};
