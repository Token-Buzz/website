import { auth } from "@clerk/nextjs/server";
import { getTrackedTokens } from "@monorepo-template/core/db/tokens";
import { getHourlySentiment } from "@monorepo-template/core/db/aggregates";
import { getPulse } from "@monorepo-template/core/db/aggregates";

// KPI strip: 24h mentions total, token count, net sentiment score.
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

  // Aggregate 24h mentions from pulse data (60 min buckets = 24h)
  const pulseResults = await Promise.allSettled(
    queries.map(q => getPulse(q, 1440))
  );
  let totalMentions24h = 0;
  for (const r of pulseResults) {
    if (r.status === "fulfilled") {
      totalMentions24h += r.value.reduce((s, p) => s + p.count, 0);
    }
  }

  // Net sentiment: weighted avg score across all tokens
  const sentimentResults = await Promise.allSettled(
    queries.map(q => getHourlySentiment(q, 24))
  );
  let totalScore = 0, totalTweets = 0;
  for (const r of sentimentResults) {
    if (r.status === "fulfilled") {
      for (const h of r.value) {
        totalScore += h.totalScore;
        totalTweets += h.tweetCount;
      }
    }
  }
  const netSentiment = totalTweets > 0 ? Math.round(totalScore / totalTweets) : 0;

  return Response.json({
    mentions24h: totalMentions24h,
    tokenCount: queries.length,
    netSentiment,
  });
}
