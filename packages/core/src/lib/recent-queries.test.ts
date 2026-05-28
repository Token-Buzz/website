import { describe, expect, test } from 'vitest'
import { recentDistinctQueries } from './recent-queries'

// Helper to create a minimal item with a distinct submittedAt
function item(query: string, submittedAt: string) {
  return { query, submittedAt, userId: 'u1', queryHash: 'abc', createdAt: submittedAt }
}

describe('recentDistinctQueries', () => {
  test('empty input returns empty output', () => {
    expect(recentDistinctQueries([])).toEqual([])
  })

  test('single item is returned as-is', () => {
    const items = [item('$BTC', '2024-03-15T10:00:00.000Z')]
    expect(recentDistinctQueries(items)).toEqual(items)
  })

  test('dedupes keeping the most-recent occurrence (first in newest-first list)', () => {
    const newer = item('$BTC', '2024-03-15T12:00:00.000Z')
    const older = item('$BTC', '2024-03-14T08:00:00.000Z')
    const result = recentDistinctQueries([newer, older])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(newer)
  })

  test('preserves order of distinct items (newest-first)', () => {
    const a = item('$BTC', '2024-03-15T12:00:00.000Z')
    const b = item('#solana', '2024-03-15T11:00:00.000Z')
    const c = item('$ETH', '2024-03-15T10:00:00.000Z')
    const result = recentDistinctQueries([a, b, c])
    expect(result).toEqual([a, b, c])
  })

  test('dedupes multiple duplicates, keeping only the most-recent of each', () => {
    const btc1 = item('$BTC', '2024-03-15T12:00:00.000Z')
    const sol1 = item('#solana', '2024-03-15T11:00:00.000Z')
    const btc2 = item('$BTC', '2024-03-15T09:00:00.000Z')
    const sol2 = item('#solana', '2024-03-14T08:00:00.000Z')
    const btc3 = item('$BTC', '2024-03-13T06:00:00.000Z')
    const result = recentDistinctQueries([btc1, sol1, btc2, sol2, btc3])
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(btc1)
    expect(result[1]).toBe(sol1)
  })

  test('respects the limit — stops once limit is reached', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      item(`query-${i}`, `2024-03-15T${String(i).padStart(2, '0')}:00:00.000Z`),
    )
    const result = recentDistinctQueries(items, 5)
    expect(result).toHaveLength(5)
    expect(result[0]).toBe(items[0])
    expect(result[4]).toBe(items[4])
  })

  test('default limit is 10', () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      item(`query-${i}`, `2024-03-15T${String(i).padStart(2, '0')}:00:00.000Z`),
    )
    expect(recentDistinctQueries(items)).toHaveLength(10)
  })

  test('limit larger than distinct items returns all distinct items', () => {
    const items = [
      item('$BTC', '2024-03-15T12:00:00.000Z'),
      item('$ETH', '2024-03-15T11:00:00.000Z'),
      item('$BTC', '2024-03-15T10:00:00.000Z'),
    ]
    const result = recentDistinctQueries(items, 100)
    expect(result).toHaveLength(2)
  })

  test('limit of 1 returns only the single most-recent distinct item', () => {
    const items = [
      item('$BTC', '2024-03-15T12:00:00.000Z'),
      item('#solana', '2024-03-15T11:00:00.000Z'),
    ]
    const result = recentDistinctQueries(items, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(items[0])
  })
})
