import { auth } from "@clerk/nextjs/server";
import { getFeedItems } from "@monorepo-template/core/db/feeds";

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind") ?? "PRESS";
  if (kindParam !== "PRESS" && kindParam !== "NEWS") {
    return Response.json({ error: "Invalid kind — must be PRESS or NEWS" }, { status: 400 });
  }
  const kind = kindParam as "PRESS" | "NEWS";

  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 1), 50) : 10;

  const items = await getFeedItems({ symbol, kind, limit });
  return Response.json({ items });
}
