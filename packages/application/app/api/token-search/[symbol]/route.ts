import { auth } from "@clerk/nextjs/server";
import {
  searchTokenCandidates,
  getCachedRef,
  setRef,
} from "@monorepo-template/core/db/ohlcv";
import type { TokenRef } from "@monorepo-template/core/providers/price";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;

  const [candidates, cachedRef] = await Promise.all([
    searchTokenCandidates(symbol),
    getCachedRef(symbol),
  ]);

  const current =
    cachedRef !== null
      ? { pool: cachedRef.pool, mint: cachedRef.mint }
      : null;

  return Response.json({ candidates, current });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const pool = b?.pool;
  const mint = b?.mint;
  const source = b?.source;

  if (typeof pool !== "string" || !pool) {
    return Response.json(
      { error: "pool must be a non-empty string" },
      { status: 400 },
    );
  }
  if (typeof mint !== "string" || !mint) {
    return Response.json(
      { error: "mint must be a non-empty string" },
      { status: 400 },
    );
  }

  const ref: TokenRef = {
    symbol: symbol.toUpperCase(),
    mint,
    pool,
    chain: "solana",
    source:
      typeof source === "string" && source ? source : "geckoterminal",
  };

  await setRef(symbol, ref);

  return Response.json({ ok: true });
}
