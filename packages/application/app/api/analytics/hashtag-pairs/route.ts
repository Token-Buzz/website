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

    // Count co-occurrence of every C(n,2) hashtag pair per tweet.
    // Pairs are sorted alphabetically so [a,b] and [b,a] collapse into the same key.
    const pairCounts = new Map<string, number>();

    for (const tweet of items) {
      // TweetRecord doesn't declare hashtags in its type but putTweet writes them;
      // cast to access the stored field.
      const raw = tweet as unknown as Record<string, unknown>;
      const rawHashtags = Array.isArray(raw["hashtags"]) ? (raw["hashtags"] as string[]) : [];
      const tags = rawHashtags
        .map((h: string) => h.toLowerCase())
        .sort();
      // De-duplicate within the same tweet to avoid counting the same pair twice
      const uniqueTags = Array.from(new Set(tags));

      for (let i = 0; i < uniqueTags.length; i++) {
        for (let j = i + 1; j < uniqueTags.length; j++) {
          const key = `${uniqueTags[i]}|${uniqueTags[j]}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    // Sort by count desc, slice top 25
    const pairs = Array.from(pairCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([key, count]) => {
        const [a, b] = key.split("|");
        return { pair: [a, b] as [string, string], count };
      });

    return Response.json({ pairs, truncated });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
