import { auth } from "@clerk/nextjs/server";
import { getSentiment } from "@monorepo-template/core/db/aggregates";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await listTrackedTokens({ limit: 8 });
  const syms = tokens.length > 0
    ? tokens.map(t => t.sym)
    : ["PEPE", "SOL", "MOG", "WIF"];

  const results = await Promise.allSettled(
    syms.map(async (symbol) => {
      const records = await getSentiment(symbol, "24H");
      const totals = records.reduce(
        (acc, r) => ({
          bullCount: acc.bullCount + (r.bull ?? 0),
          neutralCount: acc.neutralCount + (r.neu ?? 0),
          bearCount: acc.bearCount + (r.bear ?? 0),
          totalScore: acc.totalScore + (r.score ?? 0),
          tweetCount: acc.tweetCount + r.count,
        }),
        { bullCount: 0, neutralCount: 0, bearCount: 0, totalScore: 0, tweetCount: 0 }
      );
      const avgScore = totals.tweetCount > 0
        ? Math.round(totals.totalScore / totals.tweetCount)
        : 0;
      return { symbol, bullCount: totals.bullCount, neutralCount: totals.neutralCount, bearCount: totals.bearCount, avgScore, tweetCount: totals.tweetCount };
    })
  );

  const sentiment = results
    .filter((r): r is PromiseFulfilledResult<{ symbol: string; bullCount: number; neutralCount: number; bearCount: number; avgScore: number; tweetCount: number }> => r.status === "fulfilled")
    .map(r => r.value);

  return Response.json({ sentiment });
}
