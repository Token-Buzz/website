import { auth } from "@clerk/nextjs/server";
import { readAggregateTopK } from "@monorepo-template/core/db/aggregates";
import { bucketRange } from "@monorepo-template/core/db/keys";

// NOTE: This endpoint may return zero counts because sentiment.ts does not
// yet write SENTIMENT_BY_QUERY rollup rows (Phase 3 noted this as a follow-up).
// Counts will be zero until sentiment.ts is extended to invoke the aggregator
// on MODIFY events after writing the sentiment field.

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  const window = (searchParams.get("window") ?? "24H") as "1H" | "4H" | "24H" | "7D";
  const buckets = bucketRange(window, "hour");
  const from = buckets[0];
  const to = buckets[buckets.length - 1];

  try {
    const rows = await readAggregateTopK({
      type: "SENTIMENT_BY_QUERY",
      query,
      from,
      to,
      k: 1000,
    });

    let positive = 0;
    let neutral = 0;
    let negative = 0;
    for (const row of rows) {
      if (row.value === "positive") positive += row.count;
      else if (row.value === "neutral") neutral += row.count;
      else if (row.value === "negative") negative += row.count;
    }

    const total = positive + neutral + negative;
    // averageScore = (positive - negative) / total, range -1..1, 0 if total is 0
    const averageScore =
      total > 0 ? Math.round(((positive - negative) / total) * 100) / 100 : 0;

    return Response.json({ positive, neutral, negative, averageScore });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
