export type Plan = 'free' | 'pro' | 'alpha'
export type PaidPlan = Exclude<Plan, 'free'>
export type BillingInterval = 'month' | 'year'

export interface TierPrice {
  /** Amount in USD cents. */
  amount: number
  /** Env var holding the Stripe Price ID for this plan × interval. */
  priceIdEnvVar: string
}

export interface TierConfig {
  plan: Plan
  label: string
  /** Hum AI queries per month; null = unlimited. */
  humMonthly: number | null
  /** Tweet-ingestion queries per month; null = unlimited. */
  ingestionMonthly: number | null
  /** Stripe pricing per interval; null for the free tier. */
  prices: Record<BillingInterval, TierPrice> | null
  /** Query-history snapshot retention in days; null = no expiry. */
  historyRetentionDays: number | null
}

export const TIERS: Record<Plan, TierConfig> = {
  free: { plan: 'free', label: 'Free', humMonthly: 10, ingestionMonthly: 5, prices: null, historyRetentionDays: 30 },
  pro: {
    plan: 'pro',
    label: 'Pro',
    humMonthly: 500,
    ingestionMonthly: 50,
    prices: {
      month: { amount: 2400, priceIdEnvVar: 'STRIPE_PRICE_PRO_MONTH' },
      year: { amount: 24000, priceIdEnvVar: 'STRIPE_PRICE_PRO_YEAR' },
    },
    historyRetentionDays: 365,
  },
  alpha: {
    plan: 'alpha',
    label: 'Alpha',
    humMonthly: null,
    ingestionMonthly: null,
    prices: {
      month: { amount: 24000, priceIdEnvVar: 'STRIPE_PRICE_ALPHA_MONTH' },
      year: { amount: 240000, priceIdEnvVar: 'STRIPE_PRICE_ALPHA_YEAR' },
    },
    historyRetentionDays: null,
  },
}

export const DEFAULT_PLAN: Plan = 'free'
export const PAID_PLANS: PaidPlan[] = ['pro', 'alpha']
export const BILLING_INTERVALS: BillingInterval[] = ['month', 'year']

/** Days a past_due paid plan keeps full access before falling back to free. */
export const GRACE_PERIOD_DAYS = 7

export function evaluateHumQuota(
  plan: Plan,
  used: number,
): { allowed: boolean; limit: number | null } {
  const limit = TIERS[plan].humMonthly
  const allowed = limit === null || used < limit
  return { allowed, limit }
}

export function evaluateIngestionQuota(
  plan: Plan,
  used: number,
): { allowed: boolean; limit: number | null } {
  const limit = TIERS[plan].ingestionMonthly
  const allowed = limit === null || used < limit
  return { allowed, limit }
}

/**
 * Epoch-seconds DynamoDB TTL for a snapshot saved at `nowMs`, derived from the
 * plan's retention window. Returns null for no-expiry plans (alpha).
 */
export function historyRetentionTtl(plan: Plan, nowMs: number = Date.now()): number | null {
  const days = TIERS[plan].historyRetentionDays
  if (days == null) return null
  return Math.floor(nowMs / 1000) + days * 86_400
}

/**
 * Resolve the Stripe Price ID for a paid plan × interval from the environment.
 * Throws when the env var is unset — billing config must fail loudly, never
 * silently fall back to a placeholder.
 */
export function stripePriceId(plan: PaidPlan, interval: BillingInterval): string {
  const price = TIERS[plan].prices?.[interval]
  if (!price) throw new Error(`No Stripe price configured for plan "${plan}"`)
  const id = process.env[price.priceIdEnvVar]
  if (!id) throw new Error(`Missing Stripe price ID: set ${price.priceIdEnvVar}`)
  return id
}
