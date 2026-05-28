import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily construct the Stripe SDK client from STRIPE_SECRET_KEY. Throws loudly if unset. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!client) client = new Stripe(key);
  return client;
}
