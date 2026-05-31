export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { getPlanRecord } from "@monorepo-template/core/db/billing";
import {
  stripePriceId,
  PAID_PLANS,
  BILLING_INTERVALS,
} from "@monorepo-template/core/billing/tiers";
import type { PaidPlan, BillingInterval } from "@monorepo-template/core/billing/tiers";
import { getStripe } from "../_stripe";
import { getOrCreateCustomer } from "../_customer";

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

  // Check if user already has an active subscription
  const existing = await getPlanRecord(userId);
  if (
    existing?.stripeSubId &&
    existing.status !== "canceled"
  ) {
    return Response.json({ error: "already_subscribed" }, { status: 409 });
  }

  const u = await currentUser();
  const email =
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress;

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(userId, email);
    const price = stripePriceId(validPlan, validInterval);

    const sub = await stripe.subscriptions.create({
      customer,
      items: [{ price }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      // Expand both the Basil confirmation_secret and the legacy payment_intent so the
      // route works regardless of which field Stripe populates on the account's version.
      expand: ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"],
      metadata: { userId },
    });

    // Extract client secret — try Basil confirmation_secret first, fall back to legacy payment_intent.
    // latest_invoice is string | Invoice | null after expansion; cast narrowly to include both fields.
    const invoice = sub.latest_invoice as
      | {
          confirmation_secret?: { client_secret?: string | null } | null;
          payment_intent?: { client_secret?: string | null } | null;
        }
      | null;
    const clientSecret =
      invoice?.confirmation_secret?.client_secret ?? invoice?.payment_intent?.client_secret;

    if (!clientSecret) {
      console.error(
        "[POST /api/billing/create-subscription] No client secret in confirmation_secret",
        { subId: sub.id },
      );
      return Response.json(
        { error: "Failed to retrieve payment client secret" },
        { status: 500 },
      );
    }

    return Response.json({ subscriptionId: sub.id, clientSecret });
  } catch (err) {
    console.error("[POST /api/billing/create-subscription] Stripe error:", err);
    const code =
      err && typeof err === "object" && "code" in err && typeof (err as { code?: unknown }).code === "string"
        ? (err as { code: string }).code
        : undefined;
    return Response.json(
      { error: "Failed to create subscription", ...(code ? { code } : {}) },
      { status: 500 },
    );
  }
}
