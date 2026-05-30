import { auth } from "@clerk/nextjs/server";
import {
  listWatchlistEntries,
  reorderWatchlistEntries,
} from "@monorepo-template/core/db/watchlist-entries";

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

  if (!Array.isArray(raw.ids)) {
    return Response.json({ error: "ids must be an array of entry id strings" }, { status: 400 });
  }

  const ids = raw.ids as unknown[];
  if (!ids.every((id) => typeof id === "string")) {
    return Response.json({ error: "each id must be a string" }, { status: 400 });
  }

  const entryIds = ids as string[];

  // Verify all ids belong to this user.
  const existing = await listWatchlistEntries(userId);
  const ownedIds = new Set(existing.map((e) => e.entryId));
  const unowned = entryIds.filter((id) => !ownedIds.has(id));
  if (unowned.length > 0) {
    return Response.json(
      { error: `Entry ids not found for this user: ${unowned.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    await reorderWatchlistEntries(userId, entryIds);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/watchlist/reorder] reorderWatchlistEntries failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
