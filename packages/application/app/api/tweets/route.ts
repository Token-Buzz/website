import { auth } from "@clerk/nextjs/server";
import { getTweetsByQuery } from "@monorepo-template/core/db/tweets";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "PEPE";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const { items } = await getTweetsByQuery(query, { limit });
  const tweets = items.map(t => ({
    tweetId: t.id,
    query: t.symbol,
    text: t.text,
    authorUsername: t.handle,
    authorName: t.handle,
    authorFollowers: t.followers,
    createdAt: t.timestamp,
    likeCount: t.likes,
    retweetCount: t.retweets,
    sentiment: t.sent,
  }));
  return Response.json({ tweets, query });
}
