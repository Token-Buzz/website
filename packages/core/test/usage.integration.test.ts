/**
 * Usage quota integration test — exercises the real
 * `packages/core/src/db/usage.ts` functions (getUserPlan, getHumUsage,
 * canUseHum, recordHumUsage, canRefreshQuery, recordRefreshUsage) against a
 * local dynalite DynamoDB.
 *
 * Key bug-class this harness catches: a missing GSI key on a write that makes
 * the row invisible to an index query, or an ADD expression that silently
 * creates an item with the wrong key shape.
 *
 * Free tier is WEEKLY; pro is MONTHLY.  Tests pass an explicit period to the
 * record* calls so reads land in the same bucket as canUseHum / canIngestQuery
 * / canRefreshQuery (which resolve via periodForPlan internally).
 */

import { describe, expect, test } from 'vitest'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import { planKey } from '@monorepo-template/core/db/keys'
import {
  getUserPlan,
  getHumUsage,
  canUseHum,
  recordHumUsage,
  getIngestionUsage,
  canIngestQuery,
  recordIngestionUsage,
  getRefreshUsage,
  canRefreshQuery,
  recordRefreshUsage,
  currentPeriod,
} from '@monorepo-template/core/db/usage'
import { periodForPlan, weekPeriod } from '@monorepo-template/core/billing/tiers'

/** Monthly period (used by pro tests). */
const MONTH_PERIOD = currentPeriod()

/** Weekly period (used by free-user tests — free resets weekly). */
const FREE_PERIOD = periodForPlan('free')

// ── getUserPlan ───────────────────────────────────────────────────────────────

describe('getUserPlan', () => {
  test('returns free plan when no PLAN row exists', async () => {
    const result = await getUserPlan('usage_test_no_plan')
    expect(result).toEqual({ plan: 'free' })
  })

  test('returns the stored plan when a PLAN row exists', async () => {
    const userId = 'usage_test_stored_plan'
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: { ...planKey(userId), plan: 'pro' },
      }),
    )
    const result = await getUserPlan(userId)
    expect(result).toEqual({ plan: 'pro' })
  })

  test('pro + past_due + future grace deadline → returns pro (still within grace)', async () => {
    const userId = 'usage_test_grace_future'
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: {
          ...planKey(userId),
          plan: 'pro',
          status: 'past_due',
          gracePeriodEndsAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    )
    const result = await getUserPlan(userId)
    expect(result).toEqual({ plan: 'pro' })
  })

  test('pro + past_due + past grace deadline → returns free (grace expired)', async () => {
    const userId = 'usage_test_grace_past'
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: {
          ...planKey(userId),
          plan: 'pro',
          status: 'past_due',
          gracePeriodEndsAt: '2000-01-01T00:00:00.000Z',
        },
      }),
    )
    const result = await getUserPlan(userId)
    expect(result).toEqual({ plan: 'free' })
  })

  test('pro + past_due + no grace deadline → returns pro (rely on deleted webhook)', async () => {
    const userId = 'usage_test_grace_no_deadline'
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: {
          ...planKey(userId),
          plan: 'pro',
          status: 'past_due',
        },
      }),
    )
    const result = await getUserPlan(userId)
    expect(result).toEqual({ plan: 'pro' })
  })
})

// ── getHumUsage ───────────────────────────────────────────────────────────────

describe('getHumUsage', () => {
  test('returns 0 when no usage row exists', async () => {
    const used = await getHumUsage('usage_test_no_usage', FREE_PERIOD)
    expect(used).toBe(0)
  })
})

// ── recordHumUsage + canUseHum (free — weekly bucket) ────────────────────────

describe('recordHumUsage (free user)', () => {
  test('increments counter on each call and canUseHum reflects it', async () => {
    const userId = 'usage_test_increment'
    const N = 3

    for (let i = 1; i <= N; i++) {
      // Record into the free (weekly) bucket so canUseHum reads the same row.
      const count = await recordHumUsage(userId, FREE_PERIOD)
      expect(count).toBe(i)
    }

    const used = await getHumUsage(userId, FREE_PERIOD)
    expect(used).toBe(N)

    const status = await canUseHum(userId)
    expect(status.used).toBe(N)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(10)
    expect(status.allowed).toBe(true)
  })

  test('free user is blocked once used reaches 10', async () => {
    const userId = 'usage_test_free_blocked'

    for (let i = 0; i < 10; i++) {
      await recordHumUsage(userId, FREE_PERIOD)
    }

    const status = await canUseHum(userId)
    expect(status.used).toBe(10)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(10)
    expect(status.allowed).toBe(false)
  })

  test('after writing a pro PLAN row, same usage count is allowed with limit=500', async () => {
    const userId = 'usage_test_pro_plan'

    // Record 10 uses — would block a free user.
    for (let i = 0; i < 10; i++) {
      await recordHumUsage(userId, MONTH_PERIOD)
    }

    // Write PLAN row directly (no plan-writer function exists yet).
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: { ...planKey(userId), plan: 'pro' },
      }),
    )

    const status = await canUseHum(userId)
    expect(status.used).toBe(10)
    expect(status.plan).toBe('pro')
    expect(status.limit).toBe(500)
    expect(status.allowed).toBe(true)
  })
})

// ── getIngestionUsage ─────────────────────────────────────────────────────────

describe('getIngestionUsage', () => {
  test('returns 0 when no usage row exists', async () => {
    const used = await getIngestionUsage('usage_test_ingest_no_usage', FREE_PERIOD)
    expect(used).toBe(0)
  })
})

// ── recordIngestionUsage + canIngestQuery (free — weekly) ────────────────────

describe('recordIngestionUsage (free user)', () => {
  test('increments counter on each call and canIngestQuery reflects it', async () => {
    const userId = 'usage_test_ingest_increment'
    const N = 3

    for (let i = 1; i <= N; i++) {
      const count = await recordIngestionUsage(userId, FREE_PERIOD)
      expect(count).toBe(i)
    }

    const used = await getIngestionUsage(userId, FREE_PERIOD)
    expect(used).toBe(N)

    const status = await canIngestQuery(userId)
    expect(status.used).toBe(N)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(10)
    expect(status.allowed).toBe(true)
  })

  test('free user is blocked once used reaches 10', async () => {
    const userId = 'usage_test_ingest_free_blocked'

    for (let i = 0; i < 10; i++) {
      await recordIngestionUsage(userId, FREE_PERIOD)
    }

    const status = await canIngestQuery(userId)
    expect(status.used).toBe(10)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(10)
    expect(status.allowed).toBe(false)
  })

  test('after writing a pro PLAN row, same usage count is allowed with limit=50', async () => {
    const userId = 'usage_test_ingest_pro_plan'

    // Record 10 uses into the monthly bucket (pro reads from monthly).
    for (let i = 0; i < 10; i++) {
      await recordIngestionUsage(userId, MONTH_PERIOD)
    }

    // Write PLAN row directly.
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: { ...planKey(userId), plan: 'pro' },
      }),
    )

    const status = await canIngestQuery(userId)
    expect(status.used).toBe(10)
    expect(status.plan).toBe('pro')
    expect(status.limit).toBe(50)
    expect(status.allowed).toBe(true)
  })
})

// ── getRefreshUsage ───────────────────────────────────────────────────────────

describe('getRefreshUsage', () => {
  test('returns 0 when no usage row exists', async () => {
    const used = await getRefreshUsage('usage_test_refresh_no_usage', FREE_PERIOD)
    expect(used).toBe(0)
  })
})

// ── recordRefreshUsage + canRefreshQuery (free — weekly) ─────────────────────

describe('recordRefreshUsage (free user)', () => {
  test('increments counter on each call and canRefreshQuery reflects it', async () => {
    const userId = 'usage_test_refresh_increment'
    const N = 3

    for (let i = 1; i <= N; i++) {
      const count = await recordRefreshUsage(userId, FREE_PERIOD)
      expect(count).toBe(i)
    }

    const used = await getRefreshUsage(userId, FREE_PERIOD)
    expect(used).toBe(N)

    const status = await canRefreshQuery(userId)
    expect(status.used).toBe(N)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(20)
    expect(status.allowed).toBe(true)
  })

  test('free user is blocked once used reaches 20', async () => {
    const userId = 'usage_test_refresh_free_blocked'

    for (let i = 0; i < 20; i++) {
      await recordRefreshUsage(userId, FREE_PERIOD)
    }

    const status = await canRefreshQuery(userId)
    expect(status.used).toBe(20)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(20)
    expect(status.allowed).toBe(false)
  })

  test('after writing a pro PLAN row, same usage count is allowed with limit=500', async () => {
    const userId = 'usage_test_refresh_pro_plan'

    // Record 20 uses into the monthly bucket (pro reads from monthly).
    for (let i = 0; i < 20; i++) {
      await recordRefreshUsage(userId, MONTH_PERIOD)
    }

    // Write PLAN row directly.
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: { ...planKey(userId), plan: 'pro' },
      }),
    )

    const status = await canRefreshQuery(userId)
    expect(status.used).toBe(20)
    expect(status.plan).toBe('pro')
    expect(status.limit).toBe(500)
    expect(status.allowed).toBe(true)
  })
})

// ── weekPeriod sanity ─────────────────────────────────────────────────────────

describe('weekPeriod helper', () => {
  test('FREE_PERIOD matches weekPeriod()', () => {
    expect(FREE_PERIOD).toBe(weekPeriod())
  })
})
