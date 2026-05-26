export type Plan = 'free' | 'pro' | 'alpha'

export interface TierConfig {
  plan: Plan
  label: string
  humMonthly: number | null
}

export const TIERS: Record<Plan, TierConfig> = {
  free: { plan: 'free', label: 'Free', humMonthly: 10 },
  pro: { plan: 'pro', label: 'Pro', humMonthly: 500 },
  alpha: { plan: 'alpha', label: 'Alpha', humMonthly: null },
}

export const DEFAULT_PLAN: Plan = 'free'

export function evaluateHumQuota(
  plan: Plan,
  used: number,
): { allowed: boolean; limit: number | null } {
  const limit = TIERS[plan].humMonthly
  const allowed = limit === null || used < limit
  return { allowed, limit }
}
