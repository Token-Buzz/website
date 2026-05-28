/**
 * SavedQuery integration test — exercises the real
 * `packages/core/src/db/saved-queries.ts` functions (createSavedQuery,
 * getSavedQuery, hashQuery) against a local dynalite DynamoDB.
 */

import { describe, expect, test } from 'vitest'
import {
  createSavedQuery,
  getSavedQuery,
  hashQuery,
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
