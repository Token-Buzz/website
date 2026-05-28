import { getStripe } from "./_stripe";
import {
  getStripeCustomerId,
  setStripeCustomerId,
  upsertCustomerUserIndex,
} from "@monorepo-template/core/db/billing";

/** Return the user's Stripe customer id, creating + persisting one on first use. */
export async function getOrCreateCustomer(
  userId: string,
  email?: string,
): Promise<string> {
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;
  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });
  await Promise.all([
    setStripeCustomerId(userId, customer.id),
    upsertCustomerUserIndex(customer.id, userId),
  ]);
  return customer.id;
}
