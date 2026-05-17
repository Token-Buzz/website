import { auth } from "@clerk/nextjs/server";
import { getHourlySentiment } from "@monorepo-template/core/db/aggregates";
import { getTrackedTokens } from "@monorepo-template/core/db/tokens";

// Returns a sentiment grid: one entry per tracked token with 24h aggregated stats.
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const queriesParam = searchParams.get("queries");

  let queries: string[];
  if (queriesParam) {
    queries = queriesParam.split(",").map(q => q.trim()).filter(Boolean);
  } else {
    queries = await getTrackedTokens();
    if (queries.length === 0) {
      queries = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE", "$ETH", "$ARB"];
    }
  }

  const results = await Promise.allSettled(
    queries.map(async (symbol) => {
      const hourly = await getHourlySentiment(symbol, 24);
      const totals = hourly.reduce(
        (acc, h) => ({
          bullCount: acc.bullCount + h.bullCount,
          neutralCount: acc.neutralCount + h.neutralCount,
          bearCount: acc.bearCount + h.bearCount,
          totalScore: acc.totalScore + h.totalScore,
          tweetCount: acc.tweetCount + h.tweetCount,
        }),
        { bullCount: 0, neutralCount: 0, bearCount: 0, totalScore: 0, tweetCount: 0 }
      );
      const avgScore = totals.tweetCount > 0
        ? Math.round(totals.totalScore / totals.tweetCount)
        : 0;
      return { symbol, ...totals, avgScore };
    })
  );

  const sentiment = results
    .filter((r): r is PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer T> ? T : never> => r.status === "fulfilled")
    .map(r => r.value);

  return Response.json({ sentiment });
}
