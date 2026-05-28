/**
 * Pure unit tests for the Stripe-mapping logic in stripe.ts.
 * No DynamoDB — runs in the unit suite (vitest.config.ts).
 */

import { afterEach, describe, expect, test } from 'vitest'
import {
  mapStripeStatus,
  planForPriceId,
  isDunning,
  graceWindowEnd,
  graceDaysRemaining,
  effectivePlan,
} from './stripe'

describe('mapStripeStatus', () => {
  test('passes a known Stripe status through unchanged', () => {
    expect(mapStripeStatus('active')).toBe('active')
    expect(mapStripeStatus('past_due')).toBe('past_due')
    expect(mapStripeStatus('trialing')).toBe('trialing')
    expect(mapStripeStatus('incomplete_expired')).toBe('incomplete_expired')
  })

  test('maps an unknown status to canceled', () => {
    expect(mapStripeStatus('something_new')).toBe('canceled')
    expect(mapStripeStatus('')).toBe('canceled')
  })
})

describe('planForPriceId', () => {
  const ENV_VARS = [
    'STRIPE_PRICE_PRO_MONTH',
    'STRIPE_PRICE_PRO_YEAR',
    'STRIPE_PRICE_ALPHA_MONTH',
    'STRIPE_PRICE_ALPHA_YEAR',
  ]

  afterEach(() => {
    for (const v of ENV_VARS) delete process.env[v]
  })

  test('maps a configured price id to its plan + interval', () => {
    process.env.STRIPE_PRICE_PRO_MONTH = 'price_test_pro_m'
    process.env.STRIPE_PRICE_ALPHA_YEAR = 'price_test_alpha_y'

    expect(planForPriceId('price_test_pro_m')).toEqual({
      plan: 'pro',
      interval: 'month',
    })
    expect(planForPriceId('price_test_alpha_y')).toEqual({
      plan: 'alpha',
      interval: 'year',
    })
  })

  test('returns null for an unknown / unconfigured price id', () => {
    process.env.STRIPE_PRICE_PRO_MONTH = 'price_test_pro_m'
    expect(planForPriceId('price_nope')).toBeNull()
  })

  test('returns null when no price env vars are seeded', () => {
    expect(planForPriceId('price_test_pro_m')).toBeNull()
  })
})

describe('isDunning', () => {
  test('returns true for past_due and unpaid', () => {
    expect(isDunning('past_due')).toBe(true)
    expect(isDunning('unpaid')).toBe(true)
  })

  test('returns false for active, canceled, undefined, null', () => {
    expect(isDunning('active')).toBe(false)
    expect(isDunning('canceled')).toBe(false)
    expect(isDunning(undefined)).toBe(false)
    expect(isDunning(null)).toBe(false)
  })
})

describe('graceWindowEnd', () => {
  test('returns from + 7 days as ISO string', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    expect(graceWindowEnd(from)).toBe('2026-01-08T00:00:00.000Z')
  })
})

describe('graceDaysRemaining', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')

  test('returns ceiling of remaining days for a future deadline', () => {
    // 3.5 days in the future → ceil → 4
    const deadline = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000).toISOString()
    expect(graceDaysRemaining(deadline, now)).toBe(4)
  })

  test('returns exact days when the deadline is a whole number of days away', () => {
    const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(graceDaysRemaining(deadline, now)).toBe(7)
  })

  test('returns 0 for a past deadline', () => {
    const deadline = new Date(now.getTime() - 1000).toISOString()
    expect(graceDaysRemaining(deadline, now)).toBe(0)
  })

  test('returns 0 for null', () => {
    expect(graceDaysRemaining(null, now)).toBe(0)
  })

  test('returns 0 for empty string', () => {
    expect(graceDaysRemaining('', now)).toBe(0)
  })

  test('returns 0 when deadline equals now', () => {
    expect(graceDaysRemaining(now.toISOString(), now)).toBe(0)
  })
})

describe('effectivePlan', () => {
  const now = new Date('2026-01-15T00:00:00.000Z')
  const futureDeadline = '2026-02-01T00:00:00.000Z'
  const pastDeadline = '2026-01-01T00:00:00.000Z'

  test('(a) pro + past_due + future deadline → pro', () => {
    expect(
      effectivePlan({ plan: 'pro', status: 'past_due', gracePeriodEndsAt: futureDeadline, now }),
    ).toBe('pro')
  })

  test('(b) pro + past_due + past deadline → free', () => {
    expect(
      effectivePlan({ plan: 'pro', status: 'past_due', gracePeriodEndsAt: pastDeadline, now }),
    ).toBe('free')
  })

  test('(c) pro + past_due + no deadline → pro', () => {
    expect(
      effectivePlan({ plan: 'pro', status: 'past_due', gracePeriodEndsAt: null, now }),
    ).toBe('pro')
  })

  test('(d) pro + active + past deadline → pro (only dunning statuses are gated)', () => {
    expect(
      effectivePlan({ plan: 'pro', status: 'active', gracePeriodEndsAt: pastDeadline, now }),
    ).toBe('pro')
  })

  test('(e) alpha + unpaid + past deadline → free', () => {
    expect(
      effectivePlan({ plan: 'alpha', status: 'unpaid', gracePeriodEndsAt: pastDeadline, now }),
    ).toBe('free')
  })

  test('(f) free + anything → free', () => {
    expect(
      effectivePlan({ plan: 'free', status: 'past_due', gracePeriodEndsAt: pastDeadline, now }),
    ).toBe('free')
  })
})
