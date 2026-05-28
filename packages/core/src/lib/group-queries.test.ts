import { describe, expect, test } from 'vitest'
import { groupQueriesByDate } from './group-queries'

// Fixed "now" for all tests: 2024-03-15T14:00:00.000Z (a Friday)
const NOW = '2024-03-15T14:00:00.000Z'

// Helper to create a minimal item
function item(submittedAt: string) {
  return { submittedAt, query: 'test', userId: 'u1', queryHash: 'abc', createdAt: submittedAt }
}

describe('groupQueriesByDate', () => {
  test('empty input returns empty output', () => {
    expect(groupQueriesByDate([], NOW)).toEqual([])
  })

  test('item submitted today falls in "Today"', () => {
    const items = [item('2024-03-15T09:30:00.000Z')]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items).toHaveLength(1)
  })

  test('item submitted yesterday falls in "Yesterday"', () => {
    const items = [item('2024-03-14T20:00:00.000Z')]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Yesterday')
  })

  test('item submitted 3 days ago falls in "This week"', () => {
    // 3 days ago = 2024-03-12
    const items = [item('2024-03-12T10:00:00.000Z')]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('This week')
  })

  test('item submitted 7 days ago (exactly the week boundary) falls in "This week"', () => {
    // 7 days ago = 2024-03-08 — weekStart is todayStart - 7 days = 2024-03-08T00:00:00.000Z
    // d >= weekStart → "This week"
    const items = [item('2024-03-08T00:00:00.000Z')]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('This week')
  })

  test('item submitted 10 days ago falls in "Older"', () => {
    // 10 days ago = 2024-03-05
    const items = [item('2024-03-05T12:00:00.000Z')]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Older')
  })

  test('drops empty groups — only non-empty groups are returned', () => {
    // Only "Older" items
    const items = [item('2024-01-01T00:00:00.000Z')]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups.map((g) => g.label)).toEqual(['Older'])
  })

  test('multiple items spread across groups — all four groups', () => {
    const items = [
      item('2024-03-15T08:00:00.000Z'), // Today
      item('2024-03-14T12:00:00.000Z'), // Yesterday
      item('2024-03-11T10:00:00.000Z'), // This week (4 days ago)
      item('2024-02-01T00:00:00.000Z'), // Older
    ]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'This week', 'Older'])
    groups.forEach((g) => expect(g.items).toHaveLength(1))
  })

  test('groups preserve input order within each group', () => {
    // Two "Today" items; input newest-first
    const a = item('2024-03-15T13:00:00.000Z')
    const b = item('2024-03-15T07:00:00.000Z')
    const groups = groupQueriesByDate([a, b], NOW)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items[0]).toBe(a)
    expect(groups[0].items[1]).toBe(b)
  })

  test('group ordering is always Today → Yesterday → This week → Older', () => {
    const items = [
      item('2024-01-01T00:00:00.000Z'), // Older
      item('2024-03-15T08:00:00.000Z'), // Today
    ]
    const groups = groupQueriesByDate(items, NOW)
    expect(groups[0].label).toBe('Today')
    expect(groups[1].label).toBe('Older')
  })
})
