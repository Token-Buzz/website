/**
 * Usage quota integration test — exercises the real
 * `packages/core/src/db/usage.ts` functions (getUserPlan, getHumUsage,
 * canUseHum, recordHumUsage) against a local dynalite DynamoDB.
 *
 * Key bug-class this harness catches: a missing GSI key on a write that makes
 * the row invisible to an index query, or an ADD expression that silently
 * creates an item with the wrong key shape.
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
  currentPeriod,
} from '@monorepo-template/core/db/usage'

const PERIOD = currentPeriod()

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
})

// ── getHumUsage ───────────────────────────────────────────────────────────────

describe('getHumUsage', () => {
  test('returns 0 when no usage row exists', async () => {
    const used = await getHumUsage('usage_test_no_usage', PERIOD)
    expect(used).toBe(0)
  })
})

// ── recordHumUsage + canUseHum ────────────────────────────────────────────────

describe('recordHumUsage', () => {
  test('increments counter on each call and canUseHum reflects it', async () => {
    const userId = 'usage_test_increment'
    const N = 3

    for (let i = 1; i <= N; i++) {
      const count = await recordHumUsage(userId, PERIOD)
      expect(count).toBe(i)
    }

    const used = await getHumUsage(userId, PERIOD)
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
      await recordHumUsage(userId, PERIOD)
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
      await recordHumUsage(userId, PERIOD)
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
    const used = await getIngestionUsage('usage_test_ingest_no_usage', PERIOD)
    expect(used).toBe(0)
  })
})

// ── recordIngestionUsage + canIngestQuery ─────────────────────────────────────

describe('recordIngestionUsage', () => {
  test('increments counter on each call and canIngestQuery reflects it', async () => {
    const userId = 'usage_test_ingest_increment'
    const N = 3

    for (let i = 1; i <= N; i++) {
      const count = await recordIngestionUsage(userId, PERIOD)
      expect(count).toBe(i)
    }

    const used = await getIngestionUsage(userId, PERIOD)
    expect(used).toBe(N)

    const status = await canIngestQuery(userId)
    expect(status.used).toBe(N)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(5)
    expect(status.allowed).toBe(true)
  })

  test('free user is blocked once used reaches 5', async () => {
    const userId = 'usage_test_ingest_free_blocked'

    for (let i = 0; i < 5; i++) {
      await recordIngestionUsage(userId, PERIOD)
    }

    const status = await canIngestQuery(userId)
    expect(status.used).toBe(5)
    expect(status.plan).toBe('free')
    expect(status.limit).toBe(5)
    expect(status.allowed).toBe(false)
  })

  test('after writing a pro PLAN row, same usage count is allowed with limit=50', async () => {
    const userId = 'usage_test_ingest_pro_plan'

    // Record 5 uses — would block a free user.
    for (let i = 0; i < 5; i++) {
      await recordIngestionUsage(userId, PERIOD)
    }

    // Write PLAN row directly.
    await ddb.send(
      new PutCommand({
        TableName: TableNames.userData,
        Item: { ...planKey(userId), plan: 'pro' },
      }),
    )

    const status = await canIngestQuery(userId)
    expect(status.used).toBe(5)
    expect(status.plan).toBe('pro')
    expect(status.limit).toBe(50)
    expect(status.allowed).toBe(true)
  })
})
