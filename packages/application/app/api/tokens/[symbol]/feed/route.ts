import { auth } from "@clerk/nextjs/server";
import { getFeedItems, getFeedSourceCursor } from "@monorepo-template/core/db/feeds";
import { getTokenProfile } from "@monorepo-template/core/db/token-profile";
import { feedUrlHash } from "@monorepo-template/core/lib/feeds";
import { readTopNewsSources } from "@monorepo-template/core/db/aggregates";

/** A PRESS feed is considered "stale" once it has failed this many times in a row. */
const STALE_FEED_ERROR_THRESHOLD = 3;

interface FeedHealth {
  stale: boolean;
  errorCount: number;
  lastError?: string;
  lastPublishedAt?: string;
}

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const sym = symbol.toUpperCase();

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind") ?? "PRESS";
  if (kindParam !== "PRESS" && kindParam !== "NEWS") {
    return Response.json({ error: "Invalid kind — must be PRESS or NEWS" }, { status: 400 });
  }
  const kind = kindParam as "PRESS" | "NEWS";

  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 1), 50) : 10;

  const items = await getFeedItems({ symbol: sym, kind, limit });

  // Dead-feed surfacing — only for PRESS feeds that have a configured feed URL.
  // A cursor read failure must never break the items response.
  let feedHealth: FeedHealth | null = null;
  if (kind === "PRESS") {
    try {
      const profile = await getTokenProfile(sym);
      if (profile?.pressFeedUrl) {
        const hash = feedUrlHash(profile.pressFeedUrl);
        const cursor = await getFeedSourceCursor(sym, "PRESS", hash);
        const errorCount = cursor?.errorCount ?? 0;
        feedHealth = {
          stale: errorCount >= STALE_FEED_ERROR_THRESHOLD,
          errorCount,
          ...(cursor?.lastError !== undefined && { lastError: cursor.lastError }),
          ...(cursor?.lastPublishedAt !== undefined && {
            lastPublishedAt: cursor.lastPublishedAt,
          }),
        };
      }
    } catch (err) {
      console.error("[GET /api/tokens/:symbol/feed] cursor health lookup failed:", err);
      feedHealth = null;
    }
  }

  // Top news outlets — only for NEWS feeds; failures must not break the items response.
  let topSources: Array<{ value: string; count: number }> = [];
  if (kind === "NEWS") {
    try {
      topSources = await readTopNewsSources(sym);
    } catch (err) {
      console.error("[GET /api/tokens/:symbol/feed] topSources lookup failed:", err);
      topSources = [];
    }
  }

  return Response.json({ items, feedHealth, topSources });
}
