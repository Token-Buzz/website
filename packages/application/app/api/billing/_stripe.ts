import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Lazily construct the Stripe SDK client from STRIPE_SECRET_KEY. Throws loudly if unset.
 * Pins the Basil API version (`2025-08-27.basil`) so that Basil-only fields such as
 * `latest_invoice.confirmation_secret` are always available, regardless of the account's
 * dashboard-default API version.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!client) client = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  return client;
}
