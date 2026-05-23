import { auth } from "@clerk/nextjs/server";
import { getSpikingTokens } from "@monorepo-template/core/db/tokens";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const tokens = await getSpikingTokens({ limit });
  const movers = tokens.map((t) => ({
    symbol: t.sym,
    buzzDelta: t.dbuzz,
    mentions: t.mentions,
    price: t.price,
    change24h: t.d24,
    sentiment: t.sent,
    updatedAt: t.updatedAt,
  }));
  return Response.json({ movers });
}
