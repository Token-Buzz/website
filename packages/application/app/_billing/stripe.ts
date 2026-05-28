import { loadStripe, type Stripe } from "@stripe/stripe-js";

let promise: Promise<Stripe | null> | null = null;

/** Singleton Stripe.js loader for the browser. */
export function getStripePromise(): Promise<Stripe | null> {
  if (!promise)
    promise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    );
  return promise;
}
