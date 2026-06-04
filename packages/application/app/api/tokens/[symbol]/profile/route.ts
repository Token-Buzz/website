import { auth } from "@clerk/nextjs/server";
import { getTokenProfile } from "@monorepo-template/core/db/token-profile";
import { listWatchlistEntries } from "@monorepo-template/core/db/watchlist-entries";

/**
 * GET /api/tokens/:symbol/profile
 * Returns { profile } for the token, with read precedence user → PROFILE:
 * if the requesting user has a watchlist entry for this symbol carrying
 * pressUrlOverride / pressFeedUrlOverride, those win over the global profile.
 * If there is no global profile but the user has an override, a minimal
 * profile is synthesized so the link still renders.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  const profile = await getTokenProfile(sym);

  // Look up the user's overrides for this symbol (read precedence user → PROFILE)
  const entries = await listWatchlistEntries(userId);
  const override = entries.find((e) => e.symbol.toUpperCase() === sym);
  const pressUrlOverride = override?.pressUrlOverride;
  const pressFeedUrlOverride = override?.pressFeedUrlOverride;

  if (profile) {
    if (pressUrlOverride) profile.pressUrl = pressUrlOverride;
    if (pressFeedUrlOverride) profile.pressFeedUrl = pressFeedUrlOverride;
    return Response.json({ profile });
  }

  // No global profile — synthesize one if the user supplied an override
  if (pressUrlOverride || pressFeedUrlOverride) {
    return Response.json({
      profile: {
        symbol: sym,
        source: "user" as const,
        ...(pressUrlOverride && { pressUrl: pressUrlOverride }),
        ...(pressFeedUrlOverride && { pressFeedUrl: pressFeedUrlOverride }),
      },
    });
  }

  return Response.json({ profile: null });
}
