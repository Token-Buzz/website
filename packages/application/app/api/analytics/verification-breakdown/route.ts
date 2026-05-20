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
    // Aggregator writes labels: "blue", "business", "government", "none"
    // k=100 to retrieve all label variants; actual cardinality is ≤4
    const rows = await readAggregateTopK({ type: "VERIFICATION", query, from, to, k: 100 });

    const histogram = { blue: 0, business: 0, government: 0, unverified: 0 };
    for (const row of rows) {
      const label = row.value.toLowerCase();
      if (label === "blue") histogram.blue += row.count;
      else if (label === "business") histogram.business += row.count;
      else if (label === "government") histogram.government += row.count;
      else histogram.unverified += row.count; // "none" and any unrecognised label
    }

    return Response.json(histogram);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
