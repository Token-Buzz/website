export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { getPlanRecord } from "@monorepo-template/core/db/billing";
import {
  stripePriceId,
  PAID_PLANS,
  BILLING_INTERVALS,
} from "@monorepo-template/core/billing/tiers";
import type { PaidPlan, BillingInterval } from "@monorepo-template/core/billing/tiers";
import { getStripe } from "../_stripe";

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

  const plan = raw.plan;
  const interval = raw.interval;

  if (
    typeof plan !== "string" ||
    !PAID_PLANS.includes(plan as PaidPlan)
  ) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (
    typeof interval !== "string" ||
    !BILLING_INTERVALS.includes(interval as BillingInterval)
  ) {
    return Response.json({ error: "Invalid interval" }, { status: 400 });
  }

  const validPlan = plan as PaidPlan;
  const validInterval = interval as BillingInterval;

  const record = await getPlanRecord(userId);
  if (!record?.stripeSubId) {
    return Response.json({ error: "no_subscription" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(record.stripeSubId);
    await stripe.subscriptions.update(record.stripeSubId, {
      items: [
        {
          id: sub.items.data[0].id,
          price: stripePriceId(validPlan, validInterval),
        },
      ],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/change-plan] Stripe error:", err);
    return Response.json({ error: "Failed to change plan" }, { status: 500 });
  }
}
