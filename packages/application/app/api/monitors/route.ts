import { auth } from "@clerk/nextjs/server";
import {
  putMonitor,
  getMonitor,
  listMonitors,
  deleteMonitor,
} from "@monorepo-template/core/db/monitors";
import { getUserPlan } from "@monorepo-template/core/db/usage";
import { allowedSources } from "@monorepo-template/core/sources/registry";
import { isSocialSource, type SocialSource } from "@monorepo-template/core/sources/types";

export async function GET(_req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const monitors = await listMonitors(userId);
  return Response.json({ monitors });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const query =
    typeof body.query === "string" ? body.query.trim() : undefined;
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  // Validate and default sources
  const rawSources = body.sources;
  let sources: SocialSource[];
  if (Array.isArray(rawSources) && rawSources.length > 0) {
    sources = rawSources.filter(isSocialSource);
  } else {
    sources = ["twitter"];
  }

  // Entitlement check: drop sources the plan doesn't allow
  const { plan } = await getUserPlan(userId);
  const allowed = allowedSources(plan);
  sources = sources.filter((s) => allowed.includes(s));
  if (sources.length === 0) {
    return Response.json({ error: "source_locked" }, { status: 403 });
  }

  // intervalMs: default 120000, floor at 60000
  const rawIntervalMs = body.intervalMs;
  const intervalMs =
    typeof rawIntervalMs === "number"
      ? Math.max(60000, rawIntervalMs)
      : 120000;

  const now = new Date().toISOString();

  // Look up existing monitor to preserve createdAt
  const existing = await getMonitor(userId, query);

  await putMonitor({
    userId,
    query,
    sources,
    intervalMs,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  const monitor = await getMonitor(userId, query);
  return Response.json({ monitor });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  await deleteMonitor(userId, query);
  return Response.json({ ok: true });
}
