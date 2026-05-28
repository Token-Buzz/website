import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  isStripeEventProcessed,
  markStripeEventProcessed,
  upsertCustomerUserIndex,
  resolveUserIdByCustomer,
  applySubscriptionToPlan,
  downgradeToFree,
  setPlanStatus,
  enterGracePeriod,
  getPlanRecord,
} from "@monorepo-template/core/db/billing";
import { mapStripeStatus, planForPriceId, graceWindowEnd } from "@monorepo-template/core/billing/stripe";
import { sendDowngradeEmail } from "./_email";

// Stripe signature verification needs the Node crypto runtime and the exact,
// unparsed request body — so opt out of the Edge runtime and any static caching.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe's `customer` field is sometimes an id string, sometimes an expanded object. */
function customerIdOf(
  customer: string | { id: string } | null | undefined,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Read the subscription's current-period-end unix timestamp and convert it to
 * ISO-8601. Stripe moved this field between API versions: newer versions expose
 * it per-item (`items.data[0].current_period_end`), older ones at the top level
 * (`current_period_end`). Read whichever the installed SDK exposes; the narrow
 * cast covers the top-level field that isn't on this version's typed Subscription.
 */
function currentPeriodEndIso(sub: Stripe.Subscription): string | undefined {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const fromTop = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const ts = fromItem ?? fromTop;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : undefined;
}

/** customer.subscription.created / .updated → write (or refresh) the PLAN tier. */
async function handleSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
  const customerId = customerIdOf(sub.customer);
  if (!customerId) {
    console.warn("[stripe webhook] subscription has no customer id", sub.id);
    return;
  }

  const userId = sub.metadata?.userId;
  if (!userId) {
    console.warn(
      "[stripe webhook] subscription missing metadata.userId (created outside our flow?)",
      sub.id,
    );
    return;
  }

  // Keep the reverse index fresh so invoice events can resolve the user.
  await upsertCustomerUserIndex(customerId, userId);

  const priceId = sub.items.data[0]?.price?.id;
  const mapped = priceId ? planForPriceId(priceId) : null;
  if (!mapped) {
    console.warn(
      "[stripe webhook] price not mapped to a plan (price-ID env vars not seeded?)",
      priceId,
    );
    return;
  }

  await applySubscriptionToPlan({
    userId,
    plan: mapped.plan,
    status: mapStripeStatus(sub.status),
    interval: mapped.interval,
    currentPeriodEnd: currentPeriodEndIso(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    stripeCustomerId: customerId,
    stripeSubId: sub.id,
  });
}

/** customer.subscription.deleted → drop the user back to the free tier. */
async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = customerIdOf(sub.customer);
  let userId: string | null = sub.metadata?.userId ?? null;
  if (!userId && customerId) {
    userId = await resolveUserIdByCustomer(customerId);
  }
  if (!userId) {
    console.warn(
      "[stripe webhook] could not resolve userId for deleted subscription",
      sub.id,
    );
    return;
  }
  const plan = await getPlanRecord(userId);
  const wasPaid = plan != null && plan.plan !== 'free';
  await downgradeToFree(userId, { stripeCustomerId: customerId ?? undefined });
  if (wasPaid) {
    await sendDowngradeEmail({ userId });
  }
}

/** invoice.payment_succeeded / .payment_failed → flip the PLAN status. */
async function handleInvoiceStatus(
  invoice: Stripe.Invoice,
  status: "active" | "past_due",
): Promise<void> {
  const customerId = customerIdOf(invoice.customer);
  const userId = customerId ? await resolveUserIdByCustomer(customerId) : null;
  if (!userId) {
    console.warn(
      "[stripe webhook] could not resolve userId for invoice",
      invoice.id,
    );
    return;
  }
  if (status === 'past_due') {
    await enterGracePeriod(userId, graceWindowEnd());
  } else {
    await setPlanStatus(userId, status);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !whSecret) {
    console.error(
      "[stripe webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET",
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body — req.json() would re-serialize and break signature verification.
  const rawBody = await req.text();

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch {
    console.warn("[stripe webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: a duplicate delivery is acknowledged without reprocessing.
  if (await isStripeEventProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoiceStatus(event.data.object as Stripe.Invoice, "active");
        break;
      case "invoice.payment_failed":
        await handleInvoiceStatus(event.data.object as Stripe.Invoice, "past_due");
        break;
      default:
        // Unhandled event types are intentionally ignored.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries. We mark-processed only after success below,
    // so the retry will reprocess this event from scratch.
    console.error("[stripe webhook]", event.type, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  await markStripeEventProcessed(event.id, event.type);
  return NextResponse.json({ received: true });
}
