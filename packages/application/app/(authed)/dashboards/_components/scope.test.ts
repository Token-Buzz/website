import { describe, test, expect } from 'vitest'
import { dashboardScopeQuery } from './scope'

describe('dashboardScopeQuery', () => {
  test('returns ticker when only ticker is set', () => {
    expect(dashboardScopeQuery({ ticker: 'BTC' })).toBe('BTC')
  })

  test('returns query when only query is set', () => {
    expect(dashboardScopeQuery({ query: 'AI agents' })).toBe('AI agents')
  })

  test('joins ticker and query with a space', () => {
    expect(dashboardScopeQuery({ ticker: 'ETH', query: 'DeFi' })).toBe('ETH DeFi')
  })

  test('returns empty string when neither is set', () => {
    expect(dashboardScopeQuery({})).toBe('')
  })

  test('returns empty string when both are undefined', () => {
    expect(dashboardScopeQuery({ ticker: undefined, query: undefined })).toBe('')
  })

  test('trims whitespace from ticker and query', () => {
    expect(dashboardScopeQuery({ ticker: '  BTC  ', query: '  AI  ' })).toBe('BTC AI')
  })

  test('ignores blank ticker', () => {
    expect(dashboardScopeQuery({ ticker: '   ', query: 'layer2' })).toBe('layer2')
  })

  test('ignores blank query', () => {
    expect(dashboardScopeQuery({ ticker: 'SOL', query: '' })).toBe('SOL')
  })
})
