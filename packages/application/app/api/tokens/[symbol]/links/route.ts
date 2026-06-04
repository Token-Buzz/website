import { auth } from "@clerk/nextjs/server";
import {
  listWatchlistEntries,
  createWatchlistEntry,
  setWatchlistLinkOverrides,
} from "@monorepo-template/core/db/watchlist-entries";
import { suggestQueryForTicker } from "@monorepo-template/core/lib/watchlist-query";

/**
 * GET /api/tokens/:symbol/links
 * Returns { pressUrlOverride, pressFeedUrlOverride } for the user's first
 * matching watchlist entry (or nulls if no entry / no overrides set).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  try {
    const entries = await listWatchlistEntries(userId);
    const entry = entries.find((e) => e.symbol.toUpperCase() === sym);
    return Response.json({
      pressUrlOverride: entry?.pressUrlOverride ?? null,
      pressFeedUrlOverride: entry?.pressFeedUrlOverride ?? null,
    });
  } catch (err) {
    console.error("[GET /api/tokens/:symbol/links] failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/tokens/:symbol/links
 * Body: { pressUrl?: string|null, pressFeedUrl?: string|null }
 *
 * Each provided field must be a non-empty string (the URL) or null (to clear).
 * Absent fields are left unchanged. Find-or-creates the user's watchlist entry
 * for the symbol, then writes the link overrides. Returns the effective
 * { pressUrl, pressFeedUrl } override values.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
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

  // Validate: each field, when present, must be a string or null.
  const validateField = (v: unknown): v is string | null =>
    v === null || typeof v === "string";

  if ("pressUrl" in raw && !validateField(raw.pressUrl)) {
    return Response.json(
      { error: "pressUrl must be a string or null" },
      { status: 400 },
    );
  }
  if ("pressFeedUrl" in raw && !validateField(raw.pressFeedUrl)) {
    return Response.json(
      { error: "pressFeedUrl must be a string or null" },
      { status: 400 },
    );
  }

  // Map request fields → override-builder args. Absent → undefined (unchanged).
  // A provided string is trimmed; an empty string is treated as a clear (null).
  const toOverride = (v: unknown): string | null | undefined => {
    if (!(v === null || typeof v === "string")) return undefined;
    if (v === null) return null;
    const trimmed = (v as string).trim();
    return trimmed === "" ? null : trimmed;
  };

  const pressUrlOverride = "pressUrl" in raw ? toOverride(raw.pressUrl) : undefined;
  const pressFeedUrlOverride =
    "pressFeedUrl" in raw ? toOverride(raw.pressFeedUrl) : undefined;

  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  try {
    const entries = await listWatchlistEntries(userId);
    const matching = entries.filter((e) => e.symbol.toUpperCase() === sym);

    let entryId: string;
    if (matching.length === 0) {
      const created = await createWatchlistEntry({
        userId,
        symbol: sym,
        query: suggestQueryForTicker(sym),
      });
      entryId = created.entryId;
    } else {
      entryId = matching[0].entryId;
    }

    const updated = await setWatchlistLinkOverrides(userId, entryId, {
      pressUrlOverride,
      pressFeedUrlOverride,
    });

    return Response.json({
      pressUrl: updated?.pressUrlOverride ?? null,
      pressFeedUrl: updated?.pressFeedUrlOverride ?? null,
    });
  } catch (err) {
    console.error("[PUT /api/tokens/:symbol/links] failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
