import { describe, test, expect } from 'vitest'
import { pickById } from './commandRegistry'

describe('pickById', () => {
  const items = [
    { id: 'a', value: 1 },
    { id: 'b', value: 2 },
    { id: 'c', value: 3 },
  ]

  test('returns items in the order of ids, not items', () => {
    const result = pickById(items, ['c', 'a'])
    expect(result).toEqual([{ id: 'c', value: 3 }, { id: 'a', value: 1 }])
  })

  test('skips ids not present in items', () => {
    const result = pickById(items, ['a', 'z', 'b'])
    expect(result).toEqual([{ id: 'a', value: 1 }, { id: 'b', value: 2 }])
  })

  test('returns [] for empty ids', () => {
    expect(pickById(items, [])).toEqual([])
  })

  test('handles empty items', () => {
    expect(pickById([], ['a', 'b'])).toEqual([])
  })
})
