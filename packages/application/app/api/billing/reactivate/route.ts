export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { getPlanRecord } from "@monorepo-template/core/db/billing";
import { getStripe } from "../_stripe";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const record = await getPlanRecord(userId);
  if (!record?.stripeSubId) {
    return Response.json({ error: "no_subscription" }, { status: 400 });
  }

  try {
    await getStripe().subscriptions.update(record.stripeSubId, {
      cancel_at_period_end: false,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/reactivate] Stripe error:", err);
    return Response.json({ error: "Failed to reactivate subscription" }, { status: 500 });
  }
}
