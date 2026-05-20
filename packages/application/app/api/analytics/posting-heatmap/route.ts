import { auth } from "@clerk/nextjs/server";
import { readAggregateTopK } from "@monorepo-template/core/db/aggregates";
import { bucketRange } from "@monorepo-template/core/db/keys";

// Day names used in the aggregator: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
const VALID_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

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
    // k=200 — heatmap has at most 7×24=168 distinct day-hour buckets
    const rows = await readAggregateTopK({ type: "HEATMAP", query, from, to, k: 200 });

    // Aggregate key sk value format: "Mon-14" → day="Mon", hour=14
    // The readAggregateTopK helper already merges counts by value across hour buckets,
    // so `value` here is the raw bucket label written by the aggregator.
    const points: Array<{ day: string; hour: number; count: number }> = [];
    for (const row of rows) {
      // Value may contain multiple dashes (e.g. "Mon-14"), split on the last dash
      const lastDash = row.value.lastIndexOf("-");
      if (lastDash === -1) continue;
      const day = row.value.slice(0, lastDash);
      const hourStr = row.value.slice(lastDash + 1);
      const hour = parseInt(hourStr, 10);
      if (!VALID_DAYS.has(day) || isNaN(hour) || hour < 0 || hour > 23) continue;
      points.push({ day, hour, count: row.count });
    }

    return Response.json(points);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
