/**
 * Pure unit tests for the notificationPrefsKey builder.
 * No DynamoDB access — runs in the unit suite (vitest.config.ts).
 */

import { describe, expect, test } from 'vitest'
import { notificationPrefsKey } from './keys'

describe('notificationPrefsKey', () => {
  test('produces correct pk and sk', () => {
    expect(notificationPrefsKey('user_abc123')).toEqual({
      pk: 'USER#user_abc123',
      sk: 'NOTIFPREFS',
    })
  })

  test('different userIds produce different pk values', () => {
    const a = notificationPrefsKey('user_aaa')
    const b = notificationPrefsKey('user_bbb')
    expect(a.pk).not.toBe(b.pk)
    expect(a.sk).toBe(b.sk)
  })

  test('sk is always NOTIFPREFS regardless of userId', () => {
    expect(notificationPrefsKey('any_user_id').sk).toBe('NOTIFPREFS')
    expect(notificationPrefsKey('').sk).toBe('NOTIFPREFS')
  })
})
