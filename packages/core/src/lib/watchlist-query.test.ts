import { describe, expect, test } from 'vitest'
import { suggestQueryForTicker } from './watchlist-query'

describe('suggestQueryForTicker', () => {
  test('returns $SYM OR #SYM for a plain uppercase symbol', () => {
    expect(suggestQueryForTicker('PEPE')).toBe('$PEPE OR #PEPE')
  })

  test('uppercases a lowercase symbol', () => {
    expect(suggestQueryForTicker('eth')).toBe('$ETH OR #ETH')
  })

  test('uppercases a mixed-case symbol', () => {
    expect(suggestQueryForTicker('bTc')).toBe('$BTC OR #BTC')
  })

  test('strips a leading $ before constructing the query', () => {
    expect(suggestQueryForTicker('$BTC')).toBe('$BTC OR #BTC')
  })

  test('strips a leading $ on a lowercase symbol', () => {
    expect(suggestQueryForTicker('$pepe')).toBe('$PEPE OR #PEPE')
  })

  test('handles short tickers (single character)', () => {
    expect(suggestQueryForTicker('X')).toBe('$X OR #X')
  })

  test('throws on empty string', () => {
    expect(() => suggestQueryForTicker('')).toThrow('symbol must be a non-empty string')
  })

  test('throws on whitespace-only string', () => {
    expect(() => suggestQueryForTicker('   ')).toThrow('symbol must be a non-empty string')
  })
})
