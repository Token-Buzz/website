import { auth } from "@clerk/nextjs/server";
import { readEngagementBuckets } from "@monorepo-template/core/db/aggregates";
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
    const rows = await readEngagementBuckets({ query, from, to });
    // readEngagementBuckets already returns { bucket, likes, retweets, replies, quotes }
    return Response.json(rows);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
