import { auth } from "@clerk/nextjs/server";
import { readAggregateTopK } from "@monorepo-template/core/db/aggregates";
import { bucketRange } from "@monorepo-template/core/db/keys";

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
    // Aggregator writes labels: "automated" (isLikelyBot) and "human" (not bot)
    // k=100 to retrieve all variants; actual cardinality is ≤2
    const rows = await readAggregateTopK({ type: "BOT", query, from, to, k: 100 });

    let automated = 0;
    let notAutomated = 0;
    for (const row of rows) {
      const label = row.value.toLowerCase();
      if (label === "automated") automated += row.count;
      else notAutomated += row.count; // "human" and any unrecognised label
    }

    const total = automated + notAutomated;
    const automatedPercentage =
      total > 0 ? Math.round((automated / total) * 100 * 10) / 10 : 0;

    return Response.json({
      automated,
      notAutomated,
      automatedPercentage,
      methodology: "hybrid" as const,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
