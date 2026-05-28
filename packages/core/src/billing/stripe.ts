/**
 * Pure Stripe-mapping logic — no DynamoDB, no Stripe SDK. Maps raw Stripe
 * subscription data onto our internal plan/status/interval vocabulary so the
 * webhook data layer (db/billing.ts) and the route can stay declarative.
 */

import {
  TIERS,
  PAID_PLANS,
  BILLING_INTERVALS,
  type PaidPlan,
  type BillingInterval,
} from './tiers'

export type PlanStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

const STATUSES: PlanStatus[] = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
]

/**
 * Map a raw Stripe subscription status to our PlanStatus. Stripe's status
 * values already line up 1:1 with ours, so a known string passes through;
 * anything unrecognized is treated as 'canceled' (safe default — drops access).
 */
export function mapStripeStatus(status: string): PlanStatus {
  return STATUSES.includes(status as PlanStatus)
    ? (status as PlanStatus)
    : 'canceled'
}

/**
 * Reverse-lookup a Stripe Price ID to its { plan, interval } using the
 * env-configured priceIdEnvVar values in TIERS. Returns null when no
 * configured price matches (e.g. the price-ID env vars aren't seeded yet —
 * expected until Phase 4).
 */
export function planForPriceId(
  priceId: string,
): { plan: PaidPlan; interval: BillingInterval } | null {
  for (const plan of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      const envVar = TIERS[plan].prices?.[interval]?.priceIdEnvVar
      if (envVar && process.env[envVar] === priceId) {
        return { plan, interval }
      }
    }
  }
  return null
}
