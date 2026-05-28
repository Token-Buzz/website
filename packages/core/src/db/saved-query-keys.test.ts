import { describe, expect, test } from 'vitest'
import { savedQueryKey } from './keys'

describe('savedQueryKey', () => {
  test('produces correct pk and sk', () => {
    expect(savedQueryKey('u1', '2026-05-28T14:00:00.000Z', 'abc123')).toEqual({
      pk: 'USER#u1',
      sk: 'QUERY#2026-05-28T14:00:00.000Z#abc123',
    })
  })
})
