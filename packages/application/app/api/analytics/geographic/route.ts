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
    // Cap at 2000 tweets — geo accuracy is "good enough" for chart purposes.
    // authorLocationNormalized.country is populated at ingest by the geo lookup helper.
    const { items, truncated } = await getTweetsByQueryWindow(query, {
      window,
      cap: 2000,
    });

    // Count by country, skipping tweets without resolved geo data
    const countryCounts = new Map<string, number>();
    for (const tweet of items) {
      const country = tweet.authorLocationNormalized?.country;
      if (!country) continue;
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }

    // Sort by count desc, return top 50
    const result = Array.from(countryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([country, count]) => ({ country, count }));

    return Response.json({ countries: result, truncated });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
