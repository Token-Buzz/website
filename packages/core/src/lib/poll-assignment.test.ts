import { describe, expect, test } from 'vitest'
import { assignQueriesToHolders } from './poll-assignment'

describe('assignQueriesToHolders', () => {
  test('empty input returns empty map', () => {
    expect(assignQueriesToHolders([])).toEqual(new Map())
  })

  test('disjoint queries each stay with their holder', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['$BTC', '$ETH'] },
      { userId: 'user_b', queries: ['$SOL', '$DOGE'] },
    ])
    expect(result.get('user_a')).toEqual(['$BTC', '$ETH'])
    expect(result.get('user_b')).toEqual(['$SOL', '$DOGE'])
  })

  test('overlapping queries go to the first holder only', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['$BTC', '$ETH'] },
      { userId: 'user_b', queries: ['$ETH', '$SOL'] },
    ])
    expect(result.get('user_a')).toEqual(['$BTC', '$ETH'])
    // user_b only gets $SOL; $ETH was already claimed by user_a
    expect(result.get('user_b')).toEqual(['$SOL'])
  })

  test('case-insensitive dedup: $BTC and $btc are treated as the same query', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['$BTC'] },
      { userId: 'user_b', queries: ['$btc', '$SOL'] },
    ])
    expect(result.get('user_a')).toEqual(['$BTC'])
    // $btc is a dup of $BTC (case-insensitive), so user_b only gets $SOL
    expect(result.get('user_b')).toEqual(['$SOL'])
    expect(result.has('user_b')).toBe(true)
  })

  test('original trimmed spelling from the winning holder is preserved', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['  $BTC  '] },
      { userId: 'user_b', queries: ['$btc'] },
    ])
    // The winning holder's trimmed spelling is '$BTC' (from user_a)
    expect(result.get('user_a')).toEqual(['$BTC'])
    expect(result.has('user_b')).toBe(false)
  })

  test('empty and whitespace-only queries are skipped', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['', '   ', '$BTC', '\t'] },
    ])
    expect(result.get('user_a')).toEqual(['$BTC'])
  })

  test('holder with all queries overlapping does not appear in the result', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['$BTC', '$ETH'] },
      { userId: 'user_b', queries: ['$BTC', '$ETH'] },
    ])
    expect(result.has('user_a')).toBe(true)
    expect(result.has('user_b')).toBe(false)
  })

  test('holder with no queries does not appear in the result', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: [] },
      { userId: 'user_b', queries: ['$SOL'] },
    ])
    expect(result.has('user_a')).toBe(false)
    expect(result.get('user_b')).toEqual(['$SOL'])
  })

  test('single holder gets all their queries', () => {
    const result = assignQueriesToHolders([
      { userId: 'user_a', queries: ['$BTC', '$ETH', '$SOL'] },
    ])
    expect(result.get('user_a')).toEqual(['$BTC', '$ETH', '$SOL'])
  })
})
