export type Plan = 'free' | 'pro' | 'alpha'
export type PaidPlan = Exclude<Plan, 'free'>
export type BillingInterval = 'month' | 'year'
export type UsagePeriod = 'week' | 'month'

export interface TierPrice {
  /** Amount in USD cents. */
  amount: number
  /** Env var holding the Stripe Price ID for this plan × interval. */
  priceIdEnvVar: string
}

export interface TierConfig {
  plan: Plan
  label: string
  /** Quota reset cadence for this tier. */
  period: UsagePeriod
  /** Hum AI queries per period; null = unlimited. */
  humLimit: number | null
  /** Tweet-ingestion queries per period; null = unlimited. */
  ingestionLimit: number | null
  /** Ingestion-refresh queries (re-runs of an already-run query) per period; null = unlimited. */
  refreshLimit: number | null
  /** Stripe pricing per interval; null for the free tier. */
  prices: Record<BillingInterval, TierPrice> | null
  /** Query-history snapshot retention in days; null = no expiry. */
  historyRetentionDays: number | null
}

export const TIERS: Record<Plan, TierConfig> = {
  free: { plan: 'free', label: 'Free', period: 'week', humLimit: 10, ingestionLimit: 10, refreshLimit: 20, prices: null, historyRetentionDays: 30 },
  pro: {
    plan: 'pro',
    label: 'Pro',
    period: 'month',
    humLimit: 500,
    ingestionLimit: 50,
    refreshLimit: 500,
    prices: {
      month: { amount: 2400, priceIdEnvVar: 'STRIPE_PRICE_PRO_MONTH' },
      year: { amount: 24000, priceIdEnvVar: 'STRIPE_PRICE_PRO_YEAR' },
    },
    historyRetentionDays: 365,
  },
  alpha: {
    plan: 'alpha',
    label: 'Alpha',
    period: 'month',
    humLimit: null,
    ingestionLimit: null,
    refreshLimit: null,
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
  const limit = TIERS[plan].humLimit
  const allowed = limit === null || used < limit
  return { allowed, limit }
}

export function evaluateIngestionQuota(
  plan: Plan,
  used: number,
): { allowed: boolean; limit: number | null } {
  const limit = TIERS[plan].ingestionLimit
  const allowed = limit === null || used < limit
  return { allowed, limit }
}

export function evaluateRefreshQuota(
  plan: Plan,
  used: number,
): { allowed: boolean; limit: number | null } {
  const limit = TIERS[plan].refreshLimit
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

export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, alpha: 2 }

/** True when `plan` meets or exceeds the `required` tier. */
export function planMeets(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required]
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

/** Returns the current period key as YYYYMM (e.g. "202605"). */
export function monthPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7).replace('-', '')
}

/** Returns the current ISO-8601 week key as YYYYWww (e.g. "2026W22"). */
export function weekPeriod(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}W${String(weekNo).padStart(2, '0')}`
}

/**
 * Returns the period key appropriate for the given plan:
 * weekly key for the free tier (which resets weekly), monthly key for all
 * paid tiers.
 */
export function periodForPlan(plan: Plan, now: Date = new Date()): string {
  return TIERS[plan].period === 'week' ? weekPeriod(now) : monthPeriod(now)
}
