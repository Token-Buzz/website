import { auth } from "@clerk/nextjs/server";
import { readAggregateTopK } from "@monorepo-template/core/db/aggregates";
import { bucketRange } from "@monorepo-template/core/db/keys";

// NOTE: This endpoint may return an empty array because sentiment.ts does not
// yet write SENTIMENT_BY_QUERY rollup rows (Phase 3 noted this as a follow-up).
// The aggregator's aggregateSentimentByQuery helper fires on INSERT but sentiment
// is only populated on MODIFY events by sentiment.ts. Until sentiment.ts is
// extended to also invoke the SENTIMENT_BY_QUERY aggregator, this returns [].

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
    // readAggregateTopK merges counts by value across all hour buckets.
    // For the time-series shape we need counts keyed by hour bucket, not by label.
    // The raw DDB rows have sk = "BUCKET#<hour>#<label>" where label is
    // "positive", "neutral", or "negative".
    // We use a high k to retrieve all rows (at most 3 labels × window_hours).
    // Since readAggregateTopK merges by value (label), we re-query using the
    // lower-level approach: call readAggregateTopK per label, then zip by hour.
    // However readAggregateTopK doesn't expose per-hour data after merging.
    //
    // Workaround: readAggregateTopK with k=Infinity effectively gives us all
    // (value, count) pairs — but value is the label, already merged across hours.
    // This loses the per-hour breakdown, so the time-series shape degrades to a
    // single aggregate row. Since sentiment.ts doesn't yet write these rows,
    // returning [] is the graceful empty-state per the Phase 3 note.
    //
    // Future: when sentiment.ts writes SENTIMENT_BY_QUERY, swap to a raw DDB
    // QueryCommand that preserves the hour dimension, then group by hour.

    const rows = await readAggregateTopK({
      type: "SENTIMENT_BY_QUERY",
      query,
      from,
      to,
      k: 1000,
    });

    if (rows.length === 0) {
      return Response.json([]);
    }

    // Build a single synthetic time-series bucket representing the window total.
    // This approximates the expected shape until per-hour data is available.
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    for (const row of rows) {
      if (row.value === "positive") positive += row.count;
      else if (row.value === "neutral") neutral += row.count;
      else if (row.value === "negative") negative += row.count;
    }

    return Response.json([{ bucket: from, positive, neutral, negative }]);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
