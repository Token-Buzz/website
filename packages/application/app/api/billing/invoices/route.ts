export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { getStripeCustomerId } from "@monorepo-template/core/db/billing";
import { getStripe } from "../_stripe";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await getStripeCustomerId(userId);
  if (!customer) return Response.json({ invoices: [] });

  try {
    const result = await getStripe().invoices.list({ customer, limit: 24 });
    const invoices = result.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }));
    return Response.json({ invoices });
  } catch (err) {
    console.error("[GET /api/billing/invoices] Stripe error:", err);
    return Response.json({ error: "Failed to retrieve invoices" }, { status: 500 });
  }
}
