import { describe, test, expect } from 'vitest'
import { gtTimeframe } from './geckoterminal'

describe('gtTimeframe', () => {
  test('5m maps to minute/5', () => {
    expect(gtTimeframe('5m')).toEqual({ timeframe: 'minute', aggregate: 5 })
  })

  test('1h maps to hour/1', () => {
    expect(gtTimeframe('1h')).toEqual({ timeframe: 'hour', aggregate: 1 })
  })

  test('4h maps to hour/4', () => {
    expect(gtTimeframe('4h')).toEqual({ timeframe: 'hour', aggregate: 4 })
  })

  test('1d maps to day/1', () => {
    expect(gtTimeframe('1d')).toEqual({ timeframe: 'day', aggregate: 1 })
  })
})
