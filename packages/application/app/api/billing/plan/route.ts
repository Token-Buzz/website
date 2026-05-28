export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { getPlanRecord } from "@monorepo-template/core/db/billing";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const r = await getPlanRecord(userId);
  if (!r) {
    return Response.json({
      plan: "free",
      status: "active",
      interval: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      gracePeriodEndsAt: null,
    });
  }

  return Response.json({
    plan: r.plan,
    status: r.status,
    interval: r.interval ?? null,
    cancelAtPeriodEnd: r.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: r.currentPeriodEnd ?? null,
    gracePeriodEndsAt: r.gracePeriodEndsAt ?? null,
  });
}
