import { requireUserId } from "@/app/_auth/requireUserId";
import {
  createDashboard,
  listDashboards,
} from "@monorepo-template/core/db/dashboards";
import { buildInitialDashboardCards } from "@/app/(authed)/dashboards/_components/cardActions";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dashboards = await listDashboards(userId);
  return Response.json({ dashboards });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};

  // Validate name
  const rawName = raw.name;
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  const name = rawName.trim();

  // Validate and normalize ticker (optional)
  const rawTicker = raw.ticker;
  let ticker: string | undefined;
  if (rawTicker !== undefined) {
    if (typeof rawTicker !== "string") {
      return Response.json({ error: "ticker must be a string" }, { status: 400 });
    }
    const trimmed = rawTicker.trim();
    ticker = trimmed.length > 0 ? trimmed : undefined;
  }

  // Validate and normalize query (optional)
  const rawQuery = raw.query;
  let query: string | undefined;
  if (rawQuery !== undefined) {
    if (typeof rawQuery !== "string") {
      return Response.json({ error: "query must be a string" }, { status: 400 });
    }
    const trimmed = rawQuery.trim();
    query = trimmed.length > 0 ? trimmed : undefined;
  }

  // At least one of ticker or query must be present
  if (ticker === undefined && query === undefined) {
    return Response.json(
      { error: "a dashboard needs a ticker or a query" },
      { status: 400 },
    );
  }

  const cards = buildInitialDashboardCards({ ticker, query }, () => crypto.randomUUID());

  try {
    const dashboard = await createDashboard(userId, { name, ticker, query, cards });
    return Response.json({ dashboard }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/dashboards] createDashboard failed:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
