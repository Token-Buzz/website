/**
 * SavedQuery integration test — exercises the real
 * `packages/core/src/db/saved-queries.ts` functions (createSavedQuery,
 * getSavedQuery, hashQuery, userHasQuery) against a local dynalite DynamoDB.
 */

import { describe, expect, test } from 'vitest'
import {
  createSavedQuery,
  getSavedQuery,
  hashQuery,
  userHasQuery,
} from '@monorepo-template/core/db/saved-queries'

// ── createSavedQuery + getSavedQuery (with TTL) ───────────────────────────────

describe('createSavedQuery with ttl', () => {
  test('write-read round-trip preserves all fields and ttl', async () => {
    const userId = 'sq_test_with_ttl'
    const query = 'bitcoin'
    const snapshot = { mentions: [{ mention: 'a', count: 2 }], sentimentAggregation: null }
    const ttl = 1_800_000_000

    const saved = await createSavedQuery({ userId, query, snapshot, ttl })

    expect(saved.userId).toBe(userId)
    expect(saved.query).toBe(query)
    expect(saved.queryHash).toBe(hashQuery(query))
    expect(saved.submittedAt).toBe(saved.createdAt)
    expect(saved.ttl).toBe(ttl)
    expect(saved.snapshot).toEqual(snapshot)

    const fetched = await getSavedQuery(userId, saved.submittedAt, saved.queryHash)
    expect(fetched).not.toBeNull()
    expect(fetched!.userId).toBe(userId)
    expect(fetched!.query).toBe(query)
    expect(fetched!.queryHash).toBe(saved.queryHash)
    expect(fetched!.createdAt).toBe(saved.createdAt)
    expect(fetched!.ttl).toBe(ttl)
    expect(fetched!.snapshot).toEqual(snapshot)
  })
})

// ── createSavedQuery without ttl ──────────────────────────────────────────────

describe('createSavedQuery without ttl', () => {
  test('write-read round-trip has ttl undefined', async () => {
    const userId = 'sq_test_no_ttl'
    const query = 'ethereum no ttl'
    const snapshot = { mentions: [{ mention: 'b', count: 5 }], sentimentAggregation: null }

    const saved = await createSavedQuery({ userId, query, snapshot })
    expect(saved.ttl).toBeUndefined()

    const fetched = await getSavedQuery(userId, saved.submittedAt, saved.queryHash)
    expect(fetched).not.toBeNull()
    expect(fetched!.ttl).toBeUndefined()
  })
})

// ── getSavedQuery for non-existent key ────────────────────────────────────────

describe('getSavedQuery', () => {
  test('returns null for non-existent key', async () => {
    const result = await getSavedQuery(
      'sq_test_nonexistent',
      '2000-01-01T00:00:00.000Z',
      'deadbeef00000000',
    )
    expect(result).toBeNull()
  })
})

// ── hashQuery ─────────────────────────────────────────────────────────────────

describe('hashQuery', () => {
  test('is deterministic and returns 16 hex chars', () => {
    const h1 = hashQuery('bitcoin')
    const h2 = hashQuery('bitcoin')
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(16)
    expect(/^[0-9a-f]{16}$/.test(h1)).toBe(true)
  })
})

// ── userHasQuery ──────────────────────────────────────────────────────────────

describe('userHasQuery', () => {
  test('returns false when the user has no saved queries', async () => {
    const result = await userHasQuery('sq_uhas_no_queries', 'foo bar')
    expect(result).toBe(false)
  })

  test('returns true after createSavedQuery for the same query text', async () => {
    const userId = 'sq_uhas_found'
    const query = 'foo bar'
    const snapshot = { mentions: [], sentimentAggregation: null }

    await createSavedQuery({ userId, query, snapshot })

    expect(await userHasQuery(userId, query)).toBe(true)
  })

  test('returns false for a different query text on the same user', async () => {
    const userId = 'sq_uhas_diff_query'
    const snapshot = { mentions: [], sentimentAggregation: null }

    await createSavedQuery({ userId, query: 'foo bar', snapshot })

    expect(await userHasQuery(userId, 'something else')).toBe(false)
  })

  test('different users are isolated — query on one does not appear for another', async () => {
    const snapshot = { mentions: [], sentimentAggregation: null }

    await createSavedQuery({ userId: 'sq_uhas_user_a', query: 'shared topic', snapshot })

    // user_b has no queries; should not see user_a's entry.
    expect(await userHasQuery('sq_uhas_user_b', 'shared topic')).toBe(false)
  })
})
