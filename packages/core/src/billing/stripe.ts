/**
 * Pure Stripe-mapping logic — no DynamoDB, no Stripe SDK. Maps raw Stripe
 * subscription data onto our internal plan/status/interval vocabulary so the
 * webhook data layer (db/billing.ts) and the route can stay declarative.
 */

import {
  TIERS,
  PAID_PLANS,
  BILLING_INTERVALS,
  DEFAULT_PLAN,
  GRACE_PERIOD_DAYS,
  type Plan,
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

/** Statuses that put a paid user into the dunning/grace UI. */
export function isDunning(status: PlanStatus | string | undefined | null): boolean {
  return status === 'past_due' || status === 'unpaid'
}

/**
 * ISO timestamp marking the end of the grace window, measured from a failed
 * payment (default: now). Used when a payment fails to stamp the deadline.
 */
export function graceWindowEnd(from: Date = new Date()): string {
  return new Date(
    from.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
}

/**
 * Whole days remaining until the grace window closes, rounded up and floored
 * at 0. Returns 0 for an invalid/empty deadline.
 */
export function graceDaysRemaining(
  gracePeriodEndsAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!gracePeriodEndsAt) return 0
  const ms = Date.parse(gracePeriodEndsAt) - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/**
 * The plan to enforce entitlements against. A past_due/unpaid paid plan keeps
 * full access through the grace window; once the deadline passes (e.g. Stripe's
 * subscription.deleted webhook is delayed) it falls back to the free tier. With
 * no deadline recorded we cannot tell when grace started, so we keep the paid
 * plan and rely on the deleted webhook to downgrade.
 */
export function effectivePlan(input: {
  plan: Plan
  status?: PlanStatus | string | null
  gracePeriodEndsAt?: string | null
  now?: Date
}): Plan {
  const { plan, status, gracePeriodEndsAt, now = new Date() } = input
  if (isDunning(status) && gracePeriodEndsAt) {
    if (now.getTime() > Date.parse(gracePeriodEndsAt)) return DEFAULT_PLAN
  }
  return plan
}
