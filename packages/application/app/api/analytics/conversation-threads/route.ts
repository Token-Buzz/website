import { auth } from "@clerk/nextjs/server";
import { getTweetsByQueryWindow } from "@monorepo-template/core/db/tweets";

// Depth bucket labels used in the histogram response
type DepthBucket = "1" | "2" | "3" | "4-5" | "6-10" | "11+";

function depthBucket(depth: number): DepthBucket {
  if (depth === 1) return "1";
  if (depth === 2) return "2";
  if (depth === 3) return "3";
  if (depth <= 5) return "4-5";
  if (depth <= 10) return "6-10";
  return "11+";
}

const DEPTH_ORDER: DepthBucket[] = ["1", "2", "3", "4-5", "6-10", "11+"];

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  const window = (searchParams.get("window") ?? "24H") as "1H" | "4H" | "24H" | "7D";

  try {
    const { items, truncated } = await getTweetsByQueryWindow(query, {
      window,
      cap: 2000,
    });

    // Group tweets by conversationId; tweets without a conversationId are
    // treated as standalone threads of depth 1 (their own tweetId as key).
    const threadSizes = new Map<string, number>();
    for (const tweet of items) {
      const key = tweet.conversationId ?? tweet.pk; // pk is unique per tweet
      threadSizes.set(key, (threadSizes.get(key) ?? 0) + 1);
    }

    // Build histogram keyed by depth bucket
    const histogram = new Map<DepthBucket, number>();
    for (const bucket of DEPTH_ORDER) histogram.set(bucket, 0);

    for (const size of threadSizes.values()) {
      const bucket = depthBucket(size);
      histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
    }

    // Return in canonical order, omitting buckets with 0 count
    const threads = DEPTH_ORDER.filter((b) => (histogram.get(b) ?? 0) > 0).map(
      (depth) => ({ depth, count: histogram.get(depth) ?? 0 }),
    );

    return Response.json({ threads, truncated });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
