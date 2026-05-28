/**
 * Stripe-webhook data-layer integration test — exercises the real
 * `packages/core/src/db/billing.ts` functions against a local dynalite
 * DynamoDB, doing genuine write→read round-trips.
 *
 * Critically, it also asserts the PLAN row written by applySubscriptionToPlan
 * is read back correctly by the EXISTING reader (getUserPlan in usage.ts) —
 * proving the two writers/readers agree on the row shape.
 */

import { describe, expect, test } from 'vitest'
import {
  isStripeEventProcessed,
  markStripeEventProcessed,
  upsertCustomerUserIndex,
  resolveUserIdByCustomer,
  applySubscriptionToPlan,
  getPlanRecord,
  setPlanStatus,
  downgradeToFree,
} from '@monorepo-template/core/db/billing'
import { getUserPlan } from '@monorepo-template/core/db/usage'

// ── idempotency ────────────────────────────────────────────────────────────

describe('isStripeEventProcessed / markStripeEventProcessed', () => {
  test('returns false for an unseen event, true after marking', async () => {
    const eventId = 'evt_billing_idem_1'
    expect(await isStripeEventProcessed(eventId)).toBe(false)

    await markStripeEventProcessed(eventId, 'customer.subscription.updated')
    expect(await isStripeEventProcessed(eventId)).toBe(true)
  })

  test('marks without a type and is still recorded', async () => {
    const eventId = 'evt_billing_idem_2'
    await markStripeEventProcessed(eventId)
    expect(await isStripeEventProcessed(eventId)).toBe(true)
  })
})

// ── customer → user index ──────────────────────────────────────────────────

describe('upsertCustomerUserIndex / resolveUserIdByCustomer', () => {
  test('round-trips a customer→user mapping', async () => {
    const customerId = 'cus_billing_idx_1'
    const userId = 'billing_idx_user_1'

    await upsertCustomerUserIndex(customerId, userId)
    expect(await resolveUserIdByCustomer(customerId)).toBe(userId)
  })

  test('returns null for an unknown customer', async () => {
    expect(await resolveUserIdByCustomer('cus_billing_unknown')).toBeNull()
  })
})

// ── PLAN row write + read ──────────────────────────────────────────────────

describe('applySubscriptionToPlan / getPlanRecord', () => {
  test('writes a full PLAN row that getPlanRecord and getUserPlan both read', async () => {
    const userId = 'billing_apply_user_1'
    const cpe = '2026-06-27T00:00:00.000Z'

    await applySubscriptionToPlan({
      userId,
      plan: 'pro',
      status: 'active',
      interval: 'month',
      currentPeriodEnd: cpe,
      cancelAtPeriodEnd: false,
      stripeCustomerId: 'cus_apply_1',
      stripeSubId: 'sub_apply_1',
    })

    const record = await getPlanRecord(userId)
    expect(record).not.toBeNull()
    expect(record).toMatchObject({
      plan: 'pro',
      status: 'active',
      interval: 'month',
      currentPeriodEnd: cpe,
      cancelAtPeriodEnd: false,
      stripeCustomerId: 'cus_apply_1',
      stripeSubId: 'sub_apply_1',
    })

    // The existing reader must agree with the row this writer produced.
    expect(await getUserPlan(userId)).toEqual({ plan: 'pro' })
  })

  test('getPlanRecord returns null when no PLAN row exists', async () => {
    expect(await getPlanRecord('billing_apply_user_none')).toBeNull()
  })
})

// ── setPlanStatus ────────────────────────────────────────────────────────────

describe('setPlanStatus', () => {
  test('flips status without touching plan, and can update currentPeriodEnd', async () => {
    const userId = 'billing_setstatus_user_1'

    await applySubscriptionToPlan({
      userId,
      plan: 'pro',
      status: 'active',
      interval: 'month',
      currentPeriodEnd: '2026-06-27T00:00:00.000Z',
      stripeCustomerId: 'cus_setstatus_1',
      stripeSubId: 'sub_setstatus_1',
    })

    await setPlanStatus(userId, 'past_due')
    let record = await getPlanRecord(userId)
    expect(record?.plan).toBe('pro')
    expect(record?.status).toBe('past_due')
    expect(record?.currentPeriodEnd).toBe('2026-06-27T00:00:00.000Z')

    const newCpe = '2026-07-27T00:00:00.000Z'
    await setPlanStatus(userId, 'active', newCpe)
    record = await getPlanRecord(userId)
    expect(record?.plan).toBe('pro')
    expect(record?.status).toBe('active')
    expect(record?.currentPeriodEnd).toBe(newCpe)
  })
})

// ── downgradeToFree ──────────────────────────────────────────────────────────

describe('downgradeToFree', () => {
  test('sets plan to free and status to canceled', async () => {
    const userId = 'billing_downgrade_user_1'

    await applySubscriptionToPlan({
      userId,
      plan: 'pro',
      status: 'active',
      interval: 'year',
      stripeCustomerId: 'cus_downgrade_1',
      stripeSubId: 'sub_downgrade_1',
    })

    await downgradeToFree(userId, { stripeCustomerId: 'cus_downgrade_1' })

    const record = await getPlanRecord(userId)
    expect(record?.plan).toBe('free')
    expect(record?.status).toBe('canceled')
    expect(record?.cancelAtPeriodEnd).toBe(false)
    expect(await getUserPlan(userId)).toEqual({ plan: 'free' })
  })
})
