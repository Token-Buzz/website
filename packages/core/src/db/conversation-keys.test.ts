/**
 * Pure unit tests for the Hum AI conversation key builders.
 * No DynamoDB access — these tests run in the unit suite (vitest.config.ts).
 */

import { describe, expect, test } from 'vitest'
import { conversationKey, conversationMessageKey } from './keys'

describe('conversationKey', () => {
  test('produces correct pk and sk', () => {
    expect(conversationKey('u1', 'c1')).toEqual({
      pk: 'USER#u1',
      sk: 'CONV#c1',
    })
  })

  test('encodes userId and conversationId correctly', () => {
    const key = conversationKey('user_abc', 'conv-123')
    expect(key.pk).toBe('USER#user_abc')
    expect(key.sk).toBe('CONV#conv-123')
  })
})

describe('conversationMessageKey', () => {
  test('produces correct pk and sk with timestamp', () => {
    expect(
      conversationMessageKey('u1', 'c1', '2026-01-01T00:00:00.000Z'),
    ).toEqual({
      pk: 'USER#u1',
      sk: 'MSG#c1#2026-01-01T00:00:00.000Z',
    })
  })

  test('encodes userId, conversationId, and timestamp correctly', () => {
    const key = conversationMessageKey('user_abc', 'conv-123', '2026-06-01T12:00:00.000Z')
    expect(key.pk).toBe('USER#user_abc')
    expect(key.sk).toBe('MSG#conv-123#2026-06-01T12:00:00.000Z')
  })
})

describe('disjoint-prefix invariant (CONV# vs MSG#)', () => {
  test('conversation sk does NOT start with MSG#', () => {
    const key = conversationKey('u1', 'c1')
    expect(key.sk.startsWith('MSG#')).toBe(false)
  })

  test('message sk does NOT start with CONV#', () => {
    const key = conversationMessageKey('u1', 'c1', '2026-01-01T00:00:00.000Z')
    expect(key.sk.startsWith('CONV#')).toBe(false)
  })

  test('CONV# prefix is not a prefix of MSG# prefix', () => {
    // Ensures begins_with(sk,'CONV#') never matches a message row.
    expect('MSG#c1#2026-01-01T00:00:00.000Z'.startsWith('CONV#')).toBe(false)
  })

  test('MSG# prefix is not a prefix of CONV# prefix', () => {
    // Ensures begins_with(sk,'MSG#<id>#') never matches a conversation row.
    expect('CONV#c1'.startsWith('MSG#')).toBe(false)
  })
})
