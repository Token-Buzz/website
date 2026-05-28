export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { getStripeCustomerId } from "@monorepo-template/core/db/billing";
import { getStripe } from "../_stripe";

interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await getStripeCustomerId(userId);
  if (!customer) return Response.json({ card: null });

  try {
    const stripe = getStripe();

    // Retrieve the customer to find their default payment method id
    const cust = await stripe.customers.retrieve(customer);
    if (cust.deleted) return Response.json({ card: null });

    const defaultPmId = cust.invoice_settings?.default_payment_method;

    let card: CardInfo | null = null;

    if (typeof defaultPmId === "string" && defaultPmId.length > 0) {
      // We have a specific default PM — retrieve it directly
      const pm = await stripe.paymentMethods.retrieve(defaultPmId);
      if (pm.card) {
        card = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    } else {
      // No explicit default — fall back to the most recent card on the customer
      const list = await stripe.paymentMethods.list({
        customer,
        type: "card",
        limit: 1,
      });
      const pm = list.data[0];
      if (pm?.card) {
        card = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    }

    return Response.json({ card });
  } catch (err) {
    console.error("[GET /api/billing/payment-method] Stripe error:", err);
    return Response.json({ card: null });
  }
}
