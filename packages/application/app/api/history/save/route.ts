import { auth } from "@clerk/nextjs/server";
import { createSavedQuery } from "@monorepo-template/core/db/saved-queries";
import { getUserPlan } from "@monorepo-template/core/db/usage";
import { historyRetentionTtl } from "@monorepo-template/core/billing/tiers";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { query, snapshot } = (body ?? {}) as { query?: unknown; snapshot?: unknown };

  if (typeof query !== "string" || query.trim().length === 0) {
    return Response.json({ error: "query required" }, { status: 400 });
  }
  if (query.length > 500) {
    return Response.json({ error: "query too long" }, { status: 400 });
  }
  if (snapshot === null || typeof snapshot !== "object") {
    return Response.json({ error: "snapshot required" }, { status: 400 });
  }

  // Bound the stored blob (~5–20KB normal) to guard against abuse.
  if (JSON.stringify(snapshot).length > 256_000) {
    return Response.json({ error: "snapshot too large" }, { status: 413 });
  }

  const { plan } = await getUserPlan(userId);
  const ttl = historyRetentionTtl(plan) ?? undefined;

  const saved = await createSavedQuery({ userId, query: query.trim(), snapshot, ttl });

  return Response.json({ ok: true, submittedAt: saved.submittedAt, queryHash: saved.queryHash });
}
