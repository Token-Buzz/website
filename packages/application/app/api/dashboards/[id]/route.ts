import { auth } from "@clerk/nextjs/server";
import {
  getDashboard,
  updateDashboard,
  deleteDashboard,
  type UpdateDashboardPatch,
} from "@monorepo-template/core/db/dashboards";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const dashboard = await getDashboard(userId, id);
  if (!dashboard) {
    return Response.json({ error: "Dashboard not found" }, { status: 404 });
  }
  return Response.json({ dashboard });
}

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

  const patch: UpdateDashboardPatch = {};

  // name (if present): must be non-empty string
  if ("name" in raw) {
    if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
      return Response.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    patch.name = raw.name.trim();
  }

  // ticker (if present): must be string
  if ("ticker" in raw) {
    if (typeof raw.ticker !== "string") {
      return Response.json({ error: "ticker must be a string" }, { status: 400 });
    }
    patch.ticker = raw.ticker;
  }

  // query (if present): must be string
  if ("query" in raw) {
    if (typeof raw.query !== "string") {
      return Response.json({ error: "query must be a string" }, { status: 400 });
    }
    patch.query = raw.query;
  }

  // cards (if present): must be an array
  if ("cards" in raw) {
    if (!Array.isArray(raw.cards)) {
      return Response.json({ error: "cards must be an array" }, { status: 400 });
    }
    patch.cards = raw.cards as UpdateDashboardPatch["cards"];
  }

  // Require at least one recognized field
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "no valid fields to update" }, { status: 400 });
  }

  try {
    const dashboard = await updateDashboard(userId, id, patch);
    if (!dashboard) {
      return Response.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return Response.json({ dashboard });
  } catch (err) {
    console.error("[PATCH /api/dashboards/:id] updateDashboard failed:", err);
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

  await deleteDashboard(userId, id);
  return Response.json({ success: true });
}
