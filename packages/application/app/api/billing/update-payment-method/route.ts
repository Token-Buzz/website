export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { getPlanRecord } from "@monorepo-template/core/db/billing";
import { getStripe } from "../_stripe";
import { getOrCreateCustomer } from "../_customer";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed !== null && typeof parsed === "object") {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // default to empty body — paymentMethodId is optional
  }

  const u = await currentUser();
  const email =
    u?.primaryEmailAddress?.emailAddress ??
    u?.emailAddresses?.[0]?.emailAddress;

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(userId, email);
    const paymentMethodId = body.paymentMethodId;

    if (typeof paymentMethodId === "string" && paymentMethodId.length > 0) {
      // PM was already attached to the customer when the SetupIntent was confirmed
      // client-side — do NOT call paymentMethods.attach again.
      await stripe.customers.update(customer, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Also update the subscription default PM if the user has one.
      const record = await getPlanRecord(userId);
      if (record?.stripeSubId) {
        await stripe.subscriptions.update(record.stripeSubId, {
          default_payment_method: paymentMethodId,
        });
      }

      return Response.json({ ok: true });
    }

    // No paymentMethodId supplied — create a SetupIntent so the client can
    // collect and attach a new payment method.
    const si = await stripe.setupIntents.create({
      customer,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    return Response.json({ clientSecret: si.client_secret });
  } catch (err) {
    console.error("[POST /api/billing/update-payment-method] Stripe error:", err);
    return Response.json(
      { error: "Failed to update payment method" },
      { status: 500 },
    );
  }
}
