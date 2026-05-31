import { describe, expect, test } from 'vitest'
import {
  TIERS,
  DEFAULT_PLAN,
  evaluateHumQuota,
  evaluateIngestionQuota,
  evaluateRefreshQuota,
  PAID_PLANS,
  BILLING_INTERVALS,
  stripePriceId,
  historyRetentionTtl,
  PLAN_RANK,
  planMeets,
  monthPeriod,
  weekPeriod,
  periodForPlan,
} from './tiers'

describe('TIERS', () => {
  test('free tier has humLimit=10, label=Free, period=week', () => {
    expect(TIERS.free.humLimit).toBe(10)
    expect(TIERS.free.label).toBe('Free')
    expect(TIERS.free.plan).toBe('free')
    expect(TIERS.free.period).toBe('week')
  })

  test('pro tier has humLimit=500, label=Pro, period=month', () => {
    expect(TIERS.pro.humLimit).toBe(500)
    expect(TIERS.pro.label).toBe('Pro')
    expect(TIERS.pro.plan).toBe('pro')
    expect(TIERS.pro.period).toBe('month')
  })

  test('alpha tier has humLimit=null (unlimited), label=Alpha, period=month', () => {
    expect(TIERS.alpha.humLimit).toBeNull()
    expect(TIERS.alpha.label).toBe('Alpha')
    expect(TIERS.alpha.plan).toBe('alpha')
    expect(TIERS.alpha.period).toBe('month')
  })
})

describe('TIERS period', () => {
  test('free.period === week', () => {
    expect(TIERS.free.period).toBe('week')
  })

  test('pro.period === month', () => {
    expect(TIERS.pro.period).toBe('month')
  })

  test('alpha.period === month', () => {
    expect(TIERS.alpha.period).toBe('month')
  })
})

describe('DEFAULT_PLAN', () => {
  test('is free', () => {
    expect(DEFAULT_PLAN).toBe('free')
  })
})

describe('ingestionLimit', () => {
  test('free has ingestionLimit=10', () => {
    expect(TIERS.free.ingestionLimit).toBe(10)
  })

  test('pro has ingestionLimit=50', () => {
    expect(TIERS.pro.ingestionLimit).toBe(50)
  })

  test('alpha has ingestionLimit=null (unlimited)', () => {
    expect(TIERS.alpha.ingestionLimit).toBeNull()
  })
})

describe('refreshLimit', () => {
  test('free has refreshLimit=20', () => {
    expect(TIERS.free.refreshLimit).toBe(20)
  })

  test('pro has refreshLimit=500', () => {
    expect(TIERS.pro.refreshLimit).toBe(500)
  })

  test('alpha has refreshLimit=null (unlimited)', () => {
    expect(TIERS.alpha.refreshLimit).toBeNull()
  })
})

describe('prices', () => {
  test('free tier has no prices (null)', () => {
    expect(TIERS.free.prices).toBeNull()
  })

  test('pro.month.amount=2400', () => {
    expect(TIERS.pro.prices?.month.amount).toBe(2400)
  })

  test('pro.year.amount=24000', () => {
    expect(TIERS.pro.prices?.year.amount).toBe(24000)
  })

  test('alpha.month.amount=24000', () => {
    expect(TIERS.alpha.prices?.month.amount).toBe(24000)
  })

  test('alpha.year.amount=240000', () => {
    expect(TIERS.alpha.prices?.year.amount).toBe(240000)
  })

  test('priceIdEnvVar strings match expected names', () => {
    expect(TIERS.pro.prices?.month.priceIdEnvVar).toBe('STRIPE_PRICE_PRO_MONTH')
    expect(TIERS.pro.prices?.year.priceIdEnvVar).toBe('STRIPE_PRICE_PRO_YEAR')
    expect(TIERS.alpha.prices?.month.priceIdEnvVar).toBe('STRIPE_PRICE_ALPHA_MONTH')
    expect(TIERS.alpha.prices?.year.priceIdEnvVar).toBe('STRIPE_PRICE_ALPHA_YEAR')
  })
})

describe('PAID_PLANS', () => {
  test('deep-equals [pro, alpha]', () => {
    expect(PAID_PLANS).toEqual(['pro', 'alpha'])
  })
})

describe('BILLING_INTERVALS', () => {
  test('deep-equals [month, year]', () => {
    expect(BILLING_INTERVALS).toEqual(['month', 'year'])
  })
})

describe('stripePriceId', () => {
  test('returns env var value when set', () => {
    const original = process.env.STRIPE_PRICE_PRO_MONTH
    try {
      process.env.STRIPE_PRICE_PRO_MONTH = 'price_test_123'
      expect(stripePriceId('pro', 'month')).toBe('price_test_123')
    } finally {
      if (original === undefined) {
        delete process.env.STRIPE_PRICE_PRO_MONTH
      } else {
        process.env.STRIPE_PRICE_PRO_MONTH = original
      }
    }
  })

  test('throws when env var is unset', () => {
    const original = process.env.STRIPE_PRICE_PRO_MONTH
    try {
      delete process.env.STRIPE_PRICE_PRO_MONTH
      expect(() => stripePriceId('pro', 'month')).toThrow('STRIPE_PRICE_PRO_MONTH')
    } finally {
      if (original !== undefined) {
        process.env.STRIPE_PRICE_PRO_MONTH = original
      }
    }
  })
})

describe('evaluateIngestionQuota', () => {
  test('free: allowed when used is below limit (used=0)', () => {
    const result = evaluateIngestionQuota('free', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
  })

  test('free: allowed when used=9 (one below limit)', () => {
    const result = evaluateIngestionQuota('free', 9)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
  })

  test('free: blocked at limit (used=10)', () => {
    const result = evaluateIngestionQuota('free', 10)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  test('free: blocked over limit (used=11)', () => {
    const result = evaluateIngestionQuota('free', 11)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  test('pro: allowed when used=0', () => {
    const result = evaluateIngestionQuota('pro', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(50)
  })

  test('pro: allowed when used=49 (one below limit)', () => {
    const result = evaluateIngestionQuota('pro', 49)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(50)
  })

  test('pro: blocked at limit (used=50)', () => {
    const result = evaluateIngestionQuota('pro', 50)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(50)
  })

  test('alpha: always allowed regardless of usage, limit=null', () => {
    expect(evaluateIngestionQuota('alpha', 0).allowed).toBe(true)
    expect(evaluateIngestionQuota('alpha', 10000).allowed).toBe(true)
    expect(evaluateIngestionQuota('alpha', 0).limit).toBeNull()
    expect(evaluateIngestionQuota('alpha', 10000).limit).toBeNull()
  })
})

describe('evaluateHumQuota', () => {
  test('free: allowed when used is below limit (used=0)', () => {
    const result = evaluateHumQuota('free', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
  })

  test('free: allowed when used=9 (one below limit)', () => {
    const result = evaluateHumQuota('free', 9)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
  })

  test('free: blocked at limit (used=10)', () => {
    const result = evaluateHumQuota('free', 10)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  test('free: blocked over limit (used=11)', () => {
    const result = evaluateHumQuota('free', 11)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  test('pro: allowed when used=0', () => {
    const result = evaluateHumQuota('pro', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(500)
  })

  test('pro: allowed when used=499 (one below limit)', () => {
    const result = evaluateHumQuota('pro', 499)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(500)
  })

  test('pro: blocked at limit (used=500)', () => {
    const result = evaluateHumQuota('pro', 500)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(500)
  })

  test('alpha: always allowed regardless of usage, limit=null', () => {
    expect(evaluateHumQuota('alpha', 0).allowed).toBe(true)
    expect(evaluateHumQuota('alpha', 10000).allowed).toBe(true)
    expect(evaluateHumQuota('alpha', 0).limit).toBeNull()
    expect(evaluateHumQuota('alpha', 10000).limit).toBeNull()
  })
})

describe('evaluateRefreshQuota', () => {
  test('free: allowed when used is below limit (used=0)', () => {
    const result = evaluateRefreshQuota('free', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(20)
  })

  test('free: allowed when used=19 (one below limit)', () => {
    const result = evaluateRefreshQuota('free', 19)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(20)
  })

  test('free: blocked at limit (used=20)', () => {
    const result = evaluateRefreshQuota('free', 20)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(20)
  })

  test('free: blocked over limit (used=21)', () => {
    const result = evaluateRefreshQuota('free', 21)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(20)
  })

  test('alpha: always allowed regardless of usage, limit=null', () => {
    expect(evaluateRefreshQuota('alpha', 0).allowed).toBe(true)
    expect(evaluateRefreshQuota('alpha', 10000).allowed).toBe(true)
    expect(evaluateRefreshQuota('alpha', 0).limit).toBeNull()
    expect(evaluateRefreshQuota('alpha', 10000).limit).toBeNull()
  })
})

describe('PLAN_RANK', () => {
  test('free=0, pro=1, alpha=2', () => {
    expect(PLAN_RANK.free).toBe(0)
    expect(PLAN_RANK.pro).toBe(1)
    expect(PLAN_RANK.alpha).toBe(2)
  })
})

describe('planMeets', () => {
  test('free meets free', () => {
    expect(planMeets('free', 'free')).toBe(true)
  })
  test('pro meets free', () => {
    expect(planMeets('pro', 'free')).toBe(true)
  })
  test('alpha meets free', () => {
    expect(planMeets('alpha', 'free')).toBe(true)
  })
  test('pro meets pro', () => {
    expect(planMeets('pro', 'pro')).toBe(true)
  })
  test('alpha meets pro', () => {
    expect(planMeets('alpha', 'pro')).toBe(true)
  })
  test('alpha meets alpha', () => {
    expect(planMeets('alpha', 'alpha')).toBe(true)
  })
  test('free does NOT meet pro', () => {
    expect(planMeets('free', 'pro')).toBe(false)
  })
  test('free does NOT meet alpha', () => {
    expect(planMeets('free', 'alpha')).toBe(false)
  })
  test('pro does NOT meet alpha', () => {
    expect(planMeets('pro', 'alpha')).toBe(false)
  })
})

describe('historyRetentionTtl', () => {
  test('free at nowMs=0 returns 30 * 86400', () => {
    expect(historyRetentionTtl('free', 0)).toBe(30 * 86_400)
  })

  test('pro at nowMs=0 returns 365 * 86400', () => {
    expect(historyRetentionTtl('pro', 0)).toBe(365 * 86_400)
  })

  test('alpha returns null (no expiry)', () => {
    expect(historyRetentionTtl('alpha', 0)).toBeNull()
  })

  test('non-zero nowMs: free at nowMs=10000 returns floor(10000/1000) + 30*86400', () => {
    expect(historyRetentionTtl('free', 10_000)).toBe(Math.floor(10_000 / 1000) + 30 * 86_400)
  })
})

describe('monthPeriod', () => {
  test('returns YYYYMM for 2026-05-31', () => {
    expect(monthPeriod(new Date('2026-05-31T12:00:00Z'))).toBe('202605')
  })

  test('returns YYYYMM for 2026-01-01', () => {
    expect(monthPeriod(new Date('2026-01-01T00:00:00Z'))).toBe('202601')
  })

  test('returns YYYYMM for 2025-12-31', () => {
    expect(monthPeriod(new Date('2025-12-31T23:59:59Z'))).toBe('202512')
  })
})

describe('weekPeriod', () => {
  test('returns a string matching /^\\d{4}W\\d{2}$/', () => {
    expect(/^\d{4}W\d{2}$/.test(weekPeriod(new Date('2026-05-31T00:00:00Z')))).toBe(true)
  })

  // 2026-01-01 is a Thursday; ISO week 1 of 2026 (contains the first Thursday).
  test('2026-01-01 → 2026W01', () => {
    expect(weekPeriod(new Date('2026-01-01T00:00:00Z'))).toBe('2026W01')
  })

  test('two dates in the same ISO week produce the same key', () => {
    // 2026-05-25 (Mon) and 2026-05-31 (Sun) are in the same week (W22).
    const mon = weekPeriod(new Date('2026-05-25T00:00:00Z'))
    const sun = weekPeriod(new Date('2026-05-31T00:00:00Z'))
    expect(mon).toBe(sun)
  })

  test('dates one week apart produce different keys', () => {
    const week22 = weekPeriod(new Date('2026-05-25T00:00:00Z'))
    const week23 = weekPeriod(new Date('2026-06-01T00:00:00Z'))
    expect(week22).not.toBe(week23)
  })
})

describe('periodForPlan', () => {
  test('free plan returns weekPeriod', () => {
    const d = new Date('2026-05-31T00:00:00Z')
    expect(periodForPlan('free', d)).toBe(weekPeriod(d))
  })

  test('pro plan returns monthPeriod', () => {
    const d = new Date('2026-05-31T00:00:00Z')
    expect(periodForPlan('pro', d)).toBe(monthPeriod(d))
  })

  test('alpha plan returns monthPeriod', () => {
    const d = new Date('2026-05-31T00:00:00Z')
    expect(periodForPlan('alpha', d)).toBe(monthPeriod(d))
  })
})
