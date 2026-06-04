import { auth } from "@clerk/nextjs/server";
import { getTokenProfile } from "@monorepo-template/core/db/token-profile";
import {
  listWatchlistEntries,
  createWatchlistEntry,
  setWatchlistAlertPrefs,
} from "@monorepo-template/core/db/watchlist-entries";
import { suggestQueryForTicker } from "@monorepo-template/core/lib/watchlist-query";

/**
 * GET /api/tokens/:symbol/press-alert
 * Returns { available, enabled } for the per-token press-release alert.
 *   available = the token has a press feed (TokenProfile.pressFeedUrl present).
 *   enabled   = at least one of the user's watchlist entries for this symbol
 *               has pressAlerts === true.
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
    const profile = await getTokenProfile(sym);
    const available = Boolean(profile?.pressFeedUrl);

    const entries = await listWatchlistEntries(userId);
    const enabled = entries.some(
      (e) => e.symbol.toUpperCase() === sym && e.pressAlerts === true,
    );

    return Response.json({ available, enabled });
  } catch (err) {
    console.error("[GET /api/tokens/:symbol/press-alert] failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/tokens/:symbol/press-alert
 * Body: { enabled: boolean }
 *
 * enabled=true:  ensure a watchlist entry exists for the symbol (create one
 *                with a suggested query if none), then set pressAlerts=true.
 * enabled=false: set pressAlerts=false on every matching entry (no-op if none).
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
  const enabled = raw.enabled;
  if (typeof enabled !== "boolean") {
    return Response.json(
      { error: "enabled is required and must be a boolean" },
      { status: 400 },
    );
  }

  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  try {
    const entries = await listWatchlistEntries(userId);
    const matching = entries.filter((e) => e.symbol.toUpperCase() === sym);

    if (enabled) {
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
      await setWatchlistAlertPrefs(userId, entryId, { pressAlerts: true });
    } else {
      for (const entry of matching) {
        await setWatchlistAlertPrefs(userId, entry.entryId, { pressAlerts: false });
      }
    }

    return Response.json({ enabled });
  } catch (err) {
    console.error("[PUT /api/tokens/:symbol/press-alert] failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
