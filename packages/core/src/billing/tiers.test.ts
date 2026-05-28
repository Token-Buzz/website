import { describe, expect, test } from 'vitest'
import { TIERS, DEFAULT_PLAN, evaluateHumQuota, evaluateIngestionQuota, PAID_PLANS, BILLING_INTERVALS, stripePriceId, historyRetentionTtl } from './tiers'

describe('TIERS', () => {
  test('free tier has humMonthly=10, label=Free', () => {
    expect(TIERS.free.humMonthly).toBe(10)
    expect(TIERS.free.label).toBe('Free')
    expect(TIERS.free.plan).toBe('free')
  })

  test('pro tier has humMonthly=500, label=Pro', () => {
    expect(TIERS.pro.humMonthly).toBe(500)
    expect(TIERS.pro.label).toBe('Pro')
    expect(TIERS.pro.plan).toBe('pro')
  })

  test('alpha tier has humMonthly=null (unlimited), label=Alpha', () => {
    expect(TIERS.alpha.humMonthly).toBeNull()
    expect(TIERS.alpha.label).toBe('Alpha')
    expect(TIERS.alpha.plan).toBe('alpha')
  })
})

describe('DEFAULT_PLAN', () => {
  test('is free', () => {
    expect(DEFAULT_PLAN).toBe('free')
  })
})

describe('ingestionMonthly', () => {
  test('free has ingestionMonthly=5', () => {
    expect(TIERS.free.ingestionMonthly).toBe(5)
  })

  test('pro has ingestionMonthly=50', () => {
    expect(TIERS.pro.ingestionMonthly).toBe(50)
  })

  test('alpha has ingestionMonthly=null (unlimited)', () => {
    expect(TIERS.alpha.ingestionMonthly).toBeNull()
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
    expect(result.limit).toBe(5)
  })

  test('free: allowed when used=4 (one below limit)', () => {
    const result = evaluateIngestionQuota('free', 4)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(5)
  })

  test('free: blocked at limit (used=5)', () => {
    const result = evaluateIngestionQuota('free', 5)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(5)
  })

  test('free: blocked over limit (used=6)', () => {
    const result = evaluateIngestionQuota('free', 6)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(5)
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
