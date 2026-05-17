import { auth } from "@clerk/nextjs/server";
import { getRecentTweets } from "@monorepo-template/core/db/tweets";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "$PEPE";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const tweets = await getRecentTweets(query, limit);
  return Response.json({ tweets, query });
}
