import { describe, expect, test } from 'vitest'
import {
  evaluateRule,
  isInCooldown,
  ALERT_COOLDOWN_MS,
  type AlertRule,
  type TokenSnapshot,
} from './alerts-eval'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    alertId: 'alert_1',
    userId: 'user_1',
    symbol: 'BTC',
    condition: 'mention_spike',
    threshold: 50,
    channel: 'in_app',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return {
    sym: 'BTC',
    dbuzz1h: 0,
    d24: 0,
    sent: 'neu',
    ...overrides,
  }
}

// ── mention_spike ─────────────────────────────────────────────────────────────

describe('mention_spike', () => {
  const rule = makeRule({ condition: 'mention_spike', threshold: 50 })

  test('triggers when dbuzz1h equals the threshold (boundary)', () => {
    const result = evaluateRule(rule, makeSnapshot({ dbuzz1h: 50 }))
    expect(result.triggered).toBe(true)
    expect(result.value).toBe(50)
    expect(result.link).toBe('/movers')
    expect(result.message).toContain('BTC')
    expect(result.message).toContain('+50%')
  })

  test('triggers when dbuzz1h exceeds the threshold', () => {
    const result = evaluateRule(rule, makeSnapshot({ dbuzz1h: 99 }))
    expect(result.triggered).toBe(true)
    expect(result.value).toBe(99)
  })

  test('does not trigger when dbuzz1h is below the threshold', () => {
    const result = evaluateRule(rule, makeSnapshot({ dbuzz1h: 49 }))
    expect(result.triggered).toBe(false)
    expect(result.value).toBe(49)
    expect(result.link).toBe('/movers')
  })

  test('returns a fully populated object when not triggered', () => {
    const result = evaluateRule(rule, makeSnapshot({ dbuzz1h: 10 }))
    expect(result).toHaveProperty('triggered', false)
    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('value', 10)
    expect(result).toHaveProperty('link', '/movers')
  })
})

// ── price_move ────────────────────────────────────────────────────────────────

describe('price_move', () => {
  const rule = makeRule({ condition: 'price_move', threshold: 10 })

  test('triggers on a positive move at threshold boundary', () => {
    const result = evaluateRule(rule, makeSnapshot({ d24: 10 }))
    expect(result.triggered).toBe(true)
    expect(result.value).toBe(10)
    expect(result.message).toContain('+10%')
    expect(result.link).toBe('/movers')
  })

  test('triggers on a negative move where |d24| meets the threshold', () => {
    const result = evaluateRule(rule, makeSnapshot({ d24: -10 }))
    expect(result.triggered).toBe(true)
    expect(result.value).toBe(-10)
    // Message should not have a leading '+' for negative values.
    expect(result.message).not.toContain('+-')
    expect(result.message).toContain('-10%')
  })

  test('triggers on a larger negative move', () => {
    const result = evaluateRule(rule, makeSnapshot({ d24: -25 }))
    expect(result.triggered).toBe(true)
    expect(result.value).toBe(-25)
  })

  test('does not trigger when |d24| is below threshold', () => {
    const result = evaluateRule(rule, makeSnapshot({ d24: 9 }))
    expect(result.triggered).toBe(false)
    expect(result.value).toBe(9)
  })

  test('does not trigger on a small negative move', () => {
    const result = evaluateRule(rule, makeSnapshot({ d24: -5 }))
    expect(result.triggered).toBe(false)
    expect(result.value).toBe(-5)
  })

  test('returns a fully populated object when not triggered', () => {
    const result = evaluateRule(rule, makeSnapshot({ d24: 3 }))
    expect(result).toHaveProperty('triggered', false)
    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('value', 3)
    expect(result).toHaveProperty('link', '/movers')
  })
})

// ── sentiment_swing ───────────────────────────────────────────────────────────

describe('sentiment_swing', () => {
  const rule = makeRule({ condition: 'sentiment_swing', threshold: 0 })

  test('triggers when sentiment changes and target is any (default)', () => {
    const prior = makeSnapshot({ sent: 'neu' })
    const current = makeSnapshot({ sent: 'bull' })
    const result = evaluateRule(rule, current, prior)
    expect(result.triggered).toBe(true)
    expect(result.value).toBe(0)
    expect(result.message).toContain('neu')
    expect(result.message).toContain('bull')
    expect(result.link).toBe('/live-feed')
  })

  test('does not trigger when prior is null (no baseline)', () => {
    const result = evaluateRule(rule, makeSnapshot({ sent: 'bull' }), null)
    expect(result.triggered).toBe(false)
    expect(result.link).toBe('/live-feed')
  })

  test('does not trigger when prior is undefined (no baseline)', () => {
    const result = evaluateRule(rule, makeSnapshot({ sent: 'bull' }))
    expect(result.triggered).toBe(false)
  })

  test('does not trigger when sentiment has not changed', () => {
    const snap = makeSnapshot({ sent: 'bull' })
    const result = evaluateRule(rule, snap, snap)
    expect(result.triggered).toBe(false)
  })

  test('target filtering: triggers when current sentiment matches target', () => {
    const ruleTargetBull = makeRule({ condition: 'sentiment_swing', target: 'bull' })
    const prior = makeSnapshot({ sent: 'neu' })
    const current = makeSnapshot({ sent: 'bull' })
    const result = evaluateRule(ruleTargetBull, current, prior)
    expect(result.triggered).toBe(true)
  })

  test('target filtering: does not trigger when current sentiment does not match target', () => {
    const ruleTargetBull = makeRule({ condition: 'sentiment_swing', target: 'bull' })
    const prior = makeSnapshot({ sent: 'neu' })
    const current = makeSnapshot({ sent: 'bear' })
    const result = evaluateRule(ruleTargetBull, current, prior)
    expect(result.triggered).toBe(false)
  })

  test('target=bear triggers on neu→bear swing', () => {
    const ruleTargetBear = makeRule({ condition: 'sentiment_swing', target: 'bear' })
    const prior = makeSnapshot({ sent: 'bull' })
    const current = makeSnapshot({ sent: 'bear' })
    const result = evaluateRule(ruleTargetBear, current, prior)
    expect(result.triggered).toBe(true)
  })

  test('returns a fully populated object when not triggered', () => {
    const prior = makeSnapshot({ sent: 'bull' })
    const current = makeSnapshot({ sent: 'bull' }) // no change
    const result = evaluateRule(rule, current, prior)
    expect(result).toHaveProperty('triggered', false)
    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('value', 0)
    expect(result).toHaveProperty('link', '/live-feed')
  })
})

// ── isInCooldown ──────────────────────────────────────────────────────────────

describe('isInCooldown', () => {
  const NOW = 1_700_000_000_000 // arbitrary fixed timestamp

  test('returns false when lastTriggeredAt is undefined', () => {
    expect(isInCooldown(undefined, NOW)).toBe(false)
  })

  test('returns true when within the cooldown window', () => {
    const recent = new Date(NOW - ALERT_COOLDOWN_MS + 1000).toISOString()
    expect(isInCooldown(recent, NOW)).toBe(true)
  })

  test('returns false when exactly at the cooldown boundary (elapsed === cooldown)', () => {
    const atBoundary = new Date(NOW - ALERT_COOLDOWN_MS).toISOString()
    // elapsed = ALERT_COOLDOWN_MS; condition is < (strictly less), so false.
    expect(isInCooldown(atBoundary, NOW)).toBe(false)
  })

  test('returns false when well outside the cooldown window', () => {
    const old = new Date(NOW - ALERT_COOLDOWN_MS * 2).toISOString()
    expect(isInCooldown(old, NOW)).toBe(false)
  })
})
