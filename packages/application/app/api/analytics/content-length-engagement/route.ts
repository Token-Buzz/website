import { auth } from "@clerk/nextjs/server";
import { getTweetsByQueryWindow } from "@monorepo-template/core/db/tweets";

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

    // Build scatter points: length = tweet text length, engagement = sum of interactions.
    // TweetRecord uses the legacy field names likes/retweets/replies; quoteCount is
    // written to DDB by putTweet but not yet reflected in the TweetRecord type — cast.
    const allPoints = items.map((t) => {
      const raw = t as unknown as Record<string, number>;
      return {
        length: (t.text ?? "").length,
        engagement:
          (t.likes ?? 0) +
          (t.retweets ?? 0) +
          (t.replies ?? 0) +
          (raw["quoteCount"] ?? 0),
      };
    });

    // Random-sample down to 500 points if we have more
    let points = allPoints;
    if (allPoints.length > 500) {
      const sampleRate = 500 / allPoints.length;
      points = allPoints.filter(() => Math.random() < sampleRate);
      // Clamp to exactly 500 in case floating-point rounds up slightly
      if (points.length > 500) points = points.slice(0, 500);
    }

    return Response.json({ points, truncated });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
