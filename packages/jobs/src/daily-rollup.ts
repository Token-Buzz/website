import type { Handler } from "aws-lambda";
import { getTrackedTokens } from "@monorepo-template/core/db/tokens";
import {
  getHourlySentiment,
  writeDailyRollup,
} from "@monorepo-template/core/db/aggregates";

export const handler: Handler = async () => {
  let tokens: string[];
  try {
    tokens = await getTrackedTokens();
  } catch {
    tokens = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];
  }

  // Yesterday's date
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayBucket = yesterday.toISOString().slice(0, 10); // "2025-05-15"

  for (const symbol of tokens) {
    try {
      const hourly = await getHourlySentiment(symbol, 48);
      // Filter to yesterday's rows only
      const yesterdayRows = hourly.filter((h) =>
        h.bucket.startsWith(dayBucket)
      );
      if (yesterdayRows.length === 0) continue;

      const totals = yesterdayRows.reduce(
        (acc, h) => ({
          bullCount: acc.bullCount + h.bullCount,
          neutralCount: acc.neutralCount + h.neutralCount,
          bearCount: acc.bearCount + h.bearCount,
          totalScore: acc.totalScore + h.totalScore,
          tweetCount: acc.tweetCount + h.tweetCount,
        }),
        {
          bullCount: 0,
          neutralCount: 0,
          bearCount: 0,
          totalScore: 0,
          tweetCount: 0,
        }
      );

      const avgScore =
        totals.tweetCount > 0
          ? Math.round(totals.totalScore / totals.tweetCount)
          : 0;

      await writeDailyRollup(symbol, dayBucket, {
        ...totals,
        avgScore,
        hourlyCount: yesterdayRows.length,
      });
    } catch (err) {
      console.error(`Daily rollup failed for ${symbol}:`, err);
    }
  }
};
