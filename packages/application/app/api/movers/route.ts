import { requireUserId } from "@/app/_auth/requireUserId";
import { getSpikingTokens } from "@monorepo-template/core/db/tokens";
import type { MoverWindow } from "@monorepo-template/core/movers";

function parseWindow(raw: string | null): MoverWindow {
  switch (raw?.toLowerCase()) {
    case "24h":
      return "24H";
    case "7d":
      return "7D";
    case "1h":
    default:
      return "1H";
  }
}

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const window = parseWindow(searchParams.get("window"));

  const tokens = await getSpikingTokens({ window, limit });
  const movers = tokens.map((t) => {
    // Select the delta for the requested window; fall back to dbuzz for back-compat.
    const buzzDelta =
      window === "24H"
        ? (t.dbuzz24h ?? t.dbuzz)
        : window === "7D"
          ? (t.dbuzz7d ?? t.dbuzz)
          : (t.dbuzz1h ?? t.dbuzz);

    return {
      symbol: t.sym,
      buzzDelta,
      mentions: t.mentions,
      price: t.price,
      change24h: t.d24,
      sentiment: t.sent,
      updatedAt: t.updatedAt,
    };
  });
  return Response.json({ movers });
}
