import { describe, expect, test } from 'vitest'
import { TIERS, DEFAULT_PLAN, evaluateHumQuota } from './tiers'

describe('TIERS', () => {
  test('free tier has humMonthly=10, label=Free', () => {
    expect(TIERS.free.humMonthly).toBe(10)
    expect(TIERS.free.label).toBe('Free')
    expect(TIERS.free.plan).toBe('free')
  })

  test('pro tier has humMonthly=500, label=Pro', () => {
    expect(TIERS.pro.humMonthly).toBe(500)
    expect(TIERS.pro.label).toBe('Pro')
    expect(TIERS.pro.plan).toBe('pro')
  })

  test('alpha tier has humMonthly=null (unlimited), label=Alpha', () => {
    expect(TIERS.alpha.humMonthly).toBeNull()
    expect(TIERS.alpha.label).toBe('Alpha')
    expect(TIERS.alpha.plan).toBe('alpha')
  })
})

describe('DEFAULT_PLAN', () => {
  test('is free', () => {
    expect(DEFAULT_PLAN).toBe('free')
  })
})

describe('evaluateHumQuota', () => {
  test('free: allowed when used is below limit (used=0)', () => {
    const result = evaluateHumQuota('free', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
  })

  test('free: allowed when used=9 (one below limit)', () => {
    const result = evaluateHumQuota('free', 9)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
  })

  test('free: blocked at limit (used=10)', () => {
    const result = evaluateHumQuota('free', 10)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  test('free: blocked over limit (used=11)', () => {
    const result = evaluateHumQuota('free', 11)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(10)
  })

  test('pro: allowed when used=0', () => {
    const result = evaluateHumQuota('pro', 0)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(500)
  })

  test('pro: allowed when used=499 (one below limit)', () => {
    const result = evaluateHumQuota('pro', 499)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(500)
  })

  test('pro: blocked at limit (used=500)', () => {
    const result = evaluateHumQuota('pro', 500)
    expect(result.allowed).toBe(false)
    expect(result.limit).toBe(500)
  })

  test('alpha: always allowed regardless of usage, limit=null', () => {
    expect(evaluateHumQuota('alpha', 0).allowed).toBe(true)
    expect(evaluateHumQuota('alpha', 10000).allowed).toBe(true)
    expect(evaluateHumQuota('alpha', 0).limit).toBeNull()
    expect(evaluateHumQuota('alpha', 10000).limit).toBeNull()
  })
})
