import { auth } from "@clerk/nextjs/server";
import { getTweetsByQuery } from "@monorepo-template/core/db/tweets";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const { items } = await getTweetsByQuery(query, { limit });
  const tweets = items.map((t) => ({
    tweetId: t.tweetId,
    query: t.query,
    text: t.text,
    authorUsername: t.authorUsername,
    authorName: t.authorName,
    authorFollowers: t.authorFollowers,
    createdAt: t.createdAt,
    likeCount: t.likeCount,
    retweetCount: t.retweetCount,
    sentiment: t.sentiment,
  }));
  return Response.json({ tweets, query });
}
