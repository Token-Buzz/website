/**
 * Pure unit tests for the Stripe-mapping logic in stripe.ts.
 * No DynamoDB — runs in the unit suite (vitest.config.ts).
 */

import { afterEach, describe, expect, test } from 'vitest'
import { mapStripeStatus, planForPriceId } from './stripe'

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
