import { auth } from "@clerk/nextjs/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TableNames } from "@monorepo-template/core/db/client";

// Supported timeframes for v1
const TIMEFRAME_MS: Record<string, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  const rawTimeframe = searchParams.get("timeframe") ?? "1d";
  const timeframeMs = TIMEFRAME_MS[rawTimeframe] ?? TIMEFRAME_MS["1d"];

  try {
    const now = Date.now();
    const from = new Date(now - timeframeMs).toISOString().slice(0, 16); // minute precision
    const to = new Date(now).toISOString().slice(0, 16);

    // PULSE aggregate: pk = PULSE#${query}, sk = BUCKET#${minuteBucket}
    const { Items = [] } = await ddb.send(
      new QueryCommand({
        TableName: TableNames.aggregates,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":pk": `PULSE#${query}`,
          ":from": `BUCKET#${from}`,
          ":to": `BUCKET#${to}~`,
        },
        ScanIndexForward: true,
      }),
    );

    const rows = Items as Array<{ sk: string; count?: number }>;

    if (rows.length === 0) {
      return Response.json({ rate: 0, sparkline: [] });
    }

    // Sum total tweets over the window
    const total = rows.reduce((s, r) => s + (r.count ?? 0), 0);

    // Rate = tweets per minute averaged over timeframe
    const timeframeMinutes = timeframeMs / 60_000;
    const rate = Math.round((total / timeframeMinutes) * 100) / 100;

    // Sparkline: aggregate minute buckets into hour buckets for a manageable array
    // Group by hour (first 13 chars of minute bucket, e.g. "2026-05-19T20")
    const hourMap = new Map<string, number>();
    for (const row of rows) {
      // sk = "BUCKET#2026-05-19T20:14" — hour is chars 7..20
      const bucketStr = row.sk.slice("BUCKET#".length);
      const hourKey = bucketStr.slice(0, 13); // "2026-05-19T20"
      hourMap.set(hourKey, (hourMap.get(hourKey) ?? 0) + (row.count ?? 0));
    }

    // Sort by hour key (lexicographic = chronological for ISO format) and return counts
    const sparkline = Array.from(hourMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, count]) => count);

    return Response.json({ rate, sparkline });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
