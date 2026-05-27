/**
 * Pure unit tests for the plan and usage key builders.
 * No DynamoDB access — these tests run in the unit suite (vitest.config.ts).
 */

import { describe, expect, test } from 'vitest'
import { planKey, usageKey } from './keys'

describe('planKey', () => {
  test('produces correct pk and sk', () => {
    expect(planKey('u1')).toEqual({
      pk: 'USER#u1',
      sk: 'PLAN',
    })
  })

  test('encodes userId correctly', () => {
    const key = planKey('user_abc-123')
    expect(key.pk).toBe('USER#user_abc-123')
    expect(key.sk).toBe('PLAN')
  })
})

describe('usageKey', () => {
  test('produces correct pk and sk for hum kind', () => {
    expect(usageKey('u1', '202605', 'hum')).toEqual({
      pk: 'USER#u1',
      sk: 'USAGE#202605#hum',
    })
  })

  test('encodes userId, yyyymm, and kind correctly', () => {
    const key = usageKey('user_abc', '202601', 'queries')
    expect(key.pk).toBe('USER#user_abc')
    expect(key.sk).toBe('USAGE#202601#queries')
  })

  test('different kinds produce distinct sort keys', () => {
    const humKey = usageKey('u1', '202605', 'hum')
    const queryKey = usageKey('u1', '202605', 'queries')
    expect(humKey.sk).not.toBe(queryKey.sk)
    expect(humKey.pk).toBe(queryKey.pk)
  })

  test('different periods produce distinct sort keys', () => {
    const may = usageKey('u1', '202605', 'hum')
    const june = usageKey('u1', '202606', 'hum')
    expect(may.sk).toBe('USAGE#202605#hum')
    expect(june.sk).toBe('USAGE#202606#hum')
    expect(may.sk).not.toBe(june.sk)
  })
})
