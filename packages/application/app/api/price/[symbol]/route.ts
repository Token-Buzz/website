import { auth } from "@clerk/nextjs/server";
import { getOHLCV } from "@monorepo-template/core/db/ohlcv";
import { isPriceInterval, INTERVAL_SECONDS, type PriceInterval } from "@monorepo-template/core/providers/price";

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const { searchParams } = new URL(req.url);
  const intervalRaw = searchParams.get("interval") ?? "1h";
  if (!isPriceInterval(intervalRaw)) return Response.json({ error: "invalid interval" }, { status: 400 });

  const interval: PriceInterval = intervalRaw;
  const now = Math.floor(Date.now() / 1000);
  // from/to are unix seconds; default to the most recent ~100 buckets.
  const to = parseInt(searchParams.get("to") ?? String(now), 10);
  const from = parseInt(searchParams.get("from") ?? String(to - 100 * INTERVAL_SECONDS[interval]), 10);

  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  const { bars, rateLimited, retryAfterSec } = await getOHLCV(symbol, interval, from, to);
  return Response.json({ symbol: symbol.toUpperCase(), interval, bars, rateLimited, retryAfterSec });
}
