/**
 * Pure unit tests for the Stripe key builders.
 * No DynamoDB access — these tests run in the unit suite (vitest.config.ts).
 */

import { describe, expect, test } from 'vitest'
import { stripeEventKey, stripeCustomerKey } from './keys'

describe('stripeEventKey', () => {
  test('produces correct pk and sk', () => {
    expect(stripeEventKey('evt_123')).toEqual({
      pk: 'STRIPE_EVENT#evt_123',
      sk: 'PROCESSED',
    })
  })

  test('passes special characters in the id through unchanged', () => {
    const key = stripeEventKey('evt_1A-bC_42.x')
    expect(key.pk).toBe('STRIPE_EVENT#evt_1A-bC_42.x')
    expect(key.sk).toBe('PROCESSED')
  })
})

describe('stripeCustomerKey', () => {
  test('produces correct pk and sk', () => {
    expect(stripeCustomerKey('cus_123')).toEqual({
      pk: 'STRIPE_CUSTOMER#cus_123',
      sk: 'USER',
    })
  })

  test('passes special characters in the id through unchanged', () => {
    const key = stripeCustomerKey('cus_9Z-yX_07.q')
    expect(key.pk).toBe('STRIPE_CUSTOMER#cus_9Z-yX_07.q')
    expect(key.sk).toBe('USER')
  })
})
