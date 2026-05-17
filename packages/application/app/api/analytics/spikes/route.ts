import { auth } from "@clerk/nextjs/server";
import { getSpikingTokens } from "@monorepo-template/core/db/tokens";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

  const tokens = await getSpikingTokens({ limit });
  const spikes = tokens.map(t => ({
    symbol: t.sym,
    deltaScore: t.dbuzz,
    currentMentions: t.mentions,
    priorMentions: 0,
    computedAt: t.updatedAt,
  }));
  return Response.json({ spikes });
}
