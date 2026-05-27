import { auth } from "@clerk/nextjs/server";
import { getCachedRef } from "@monorepo-template/core/db/ohlcv";
import { fetchJupiterPrice } from "@monorepo-template/core/providers/jupiter";
import { checkAndIncrement, JUPITER_LIMIT } from "@monorepo-template/core/db/rate-limit";

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;

  const ref = await getCachedRef(symbol);
  if (!ref) {
    return Response.json({ price: null, reason: "unknown_token" }, { status: 200 });
  }

  const rl = await checkAndIncrement('jupiter', JUPITER_LIMIT);
  if (!rl.allowed) {
    return Response.json({ symbol: symbol.toUpperCase(), mint: ref.mint, price: null, rateLimited: true, retryAfterSec: rl.retryAfterSec });
  }

  const price = await fetchJupiterPrice(ref.mint);
  return Response.json({ symbol: symbol.toUpperCase(), mint: ref.mint, price, rateLimited: false, retryAfterSec: 0, ts: Date.now() });
}
