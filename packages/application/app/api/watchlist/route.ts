import { auth } from "@clerk/nextjs/server";
import {
  listWatchlistEntries,
  createWatchlistEntry,
} from "@monorepo-template/core/db/watchlist-entries";
import { suggestQueryForTicker } from "@monorepo-template/core/lib/watchlist-query";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await listWatchlistEntries(userId);
  return Response.json({ entries });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};

  // Validate symbol
  const rawSymbol = raw.symbol;
  if (typeof rawSymbol !== "string" || rawSymbol.trim().length === 0) {
    return Response.json(
      { error: "symbol is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  const symbol = rawSymbol.trim();

  // query is optional — default to suggested query if omitted
  let query: string;
  if (raw.query !== undefined) {
    if (typeof raw.query !== "string" || raw.query.trim().length === 0) {
      return Response.json(
        { error: "query must be a non-empty string when provided" },
        { status: 400 },
      );
    }
    query = raw.query.trim();
  } else {
    query = suggestQueryForTicker(symbol);
  }

  try {
    const entry = await createWatchlistEntry({ userId, symbol, query });
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/watchlist] createWatchlistEntry failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
