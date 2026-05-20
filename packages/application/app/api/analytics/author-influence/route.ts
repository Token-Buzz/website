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
    // Aggregator writes labels: "low" (<1k followers), "mid" (1k–100k), "high" (>100k)
    // k=100 to retrieve all variants; actual cardinality is ≤3
    const rows = await readAggregateTopK({ type: "AUTHOR_INFLUENCE", query, from, to, k: 100 });

    const histogram = { low: 0, mid: 0, high: 0 };
    for (const row of rows) {
      const label = row.value.toLowerCase();
      if (label === "low") histogram.low += row.count;
      else if (label === "mid") histogram.mid += row.count;
      else if (label === "high") histogram.high += row.count;
    }

    return Response.json(histogram);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
