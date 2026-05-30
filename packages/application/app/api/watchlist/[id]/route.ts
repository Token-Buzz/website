import { auth } from "@clerk/nextjs/server";
import {
  getWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistEntry,
  type UpdateWatchlistEntryPatch,
} from "@monorepo-template/core/db/watchlist-entries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const patch: UpdateWatchlistEntryPatch = {};

  if ("symbol" in raw) {
    if (typeof raw.symbol !== "string" || raw.symbol.trim().length === 0) {
      return Response.json(
        { error: "symbol must be a non-empty string" },
        { status: 400 },
      );
    }
    patch.symbol = raw.symbol.trim();
  }

  if ("query" in raw) {
    if (typeof raw.query !== "string" || raw.query.trim().length === 0) {
      return Response.json(
        { error: "query must be a non-empty string" },
        { status: 400 },
      );
    }
    patch.query = raw.query.trim();
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "no valid fields to update" }, { status: 400 });
  }

  try {
    const entry = await updateWatchlistEntry(userId, id, patch);
    if (!entry) {
      return Response.json({ error: "Watchlist entry not found" }, { status: 404 });
    }
    return Response.json({ entry });
  } catch (err) {
    console.error("[PATCH /api/watchlist/:id] updateWatchlistEntry failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify the entry belongs to this user before deleting.
  const existing = await getWatchlistEntry(userId, id);
  if (!existing) {
    return Response.json({ error: "Watchlist entry not found" }, { status: 404 });
  }

  await deleteWatchlistEntry(userId, id);
  return Response.json({ ok: true });
}
