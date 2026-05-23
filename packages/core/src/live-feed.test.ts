import { describe, expect, test } from 'vitest'
import { mergeLiveFeed, type LiveFeedItem } from './live-feed'

// Helpers to build minimal items.
function item(tweetId: string, createdAt: string): LiveFeedItem {
  return { tweetId, createdAt }
}

// ISO timestamps used throughout the suite.
const T1 = '2024-01-15T12:00:00.000Z' // newest
const T2 = '2024-01-15T11:00:00.000Z'
const T3 = '2024-01-15T10:00:00.000Z'
const T4 = '2024-01-15T09:00:00.000Z' // oldest

describe('mergeLiveFeed', () => {
  test('empty pages → empty tweets, no cursor', () => {
    const result = mergeLiveFeed([], 10)
    expect(result.tweets).toEqual([])
    expect(result.nextCursorSk).toBeUndefined()
  })

  test('single empty page → empty tweets, no cursor', () => {
    const result = mergeLiveFeed([[]], 10)
    expect(result.tweets).toEqual([])
    expect(result.nextCursorSk).toBeUndefined()
  })

  test('limit ≤ 0 → empty tweets, no cursor', () => {
    const result = mergeLiveFeed([[item('a', T1)]], 0)
    expect(result.tweets).toEqual([])
    expect(result.nextCursorSk).toBeUndefined()
  })

  test('single page with fewer items than limit → no cursor', () => {
    const page = [item('1', T1), item('2', T2)]
    const result = mergeLiveFeed([page], 10)
    expect(result.tweets).toHaveLength(2)
    expect(result.nextCursorSk).toBeUndefined()
  })

  test('result exactly equals limit → cursor is set to last item composite key', () => {
    const page = [item('1', T1), item('2', T2), item('3', T3)]
    const result = mergeLiveFeed([page], 3)
    expect(result.tweets).toHaveLength(3)
    expect(result.nextCursorSk).toBe(`${T3}#3`)
  })

  test('result less than limit → cursor is undefined', () => {
    const page = [item('1', T1), item('2', T2)]
    const result = mergeLiveFeed([page], 5)
    expect(result.nextCursorSk).toBeUndefined()
  })

  test('merges multiple pages newest-first', () => {
    const pageA = [item('a', T1), item('b', T3)]
    const pageB = [item('c', T2), item('d', T4)]
    const result = mergeLiveFeed([pageA, pageB], 10)
    expect(result.tweets.map(t => t.tweetId)).toEqual(['a', 'c', 'b', 'd'])
  })

  test('deduplicates by tweetId (keeps first occurrence from first page)', () => {
    const pageA = [item('dup', T1), item('uniq-a', T2)]
    const pageB = [item('dup', T1), item('uniq-b', T3)]
    const result = mergeLiveFeed([pageA, pageB], 10)
    const ids = result.tweets.map(t => t.tweetId)
    // 'dup' appears once only.
    expect(ids.filter(id => id === 'dup')).toHaveLength(1)
    expect(ids).toContain('uniq-a')
    expect(ids).toContain('uniq-b')
  })

  test('truncates to limit after merge', () => {
    const pageA = [item('a', T1), item('b', T2)]
    const pageB = [item('c', T3), item('d', T4)]
    const result = mergeLiveFeed([pageA, pageB], 2)
    expect(result.tweets).toHaveLength(2)
    // Must be the two newest.
    expect(result.tweets.map(t => t.tweetId)).toEqual(['a', 'b'])
  })

  test('cursor points to the last (oldest) tweet in the truncated result', () => {
    const pageA = [item('a', T1), item('b', T2)]
    const pageB = [item('c', T3), item('d', T4)]
    const result = mergeLiveFeed([pageA, pageB], 2)
    expect(result.nextCursorSk).toBe(`${T2}#b`)
  })

  test('ties broken by tweetId in composite key (deterministic order)', () => {
    const sameTime = '2024-01-15T12:00:00.000Z'
    const pageA = [item('zzz', sameTime)]
    const pageB = [item('aaa', sameTime)]
    const result = mergeLiveFeed([pageA, pageB], 10)
    // 'zzz' > 'aaa' alphabetically, so 'zzz' comes first in descending order.
    expect(result.tweets[0].tweetId).toBe('zzz')
    expect(result.tweets[1].tweetId).toBe('aaa')
  })

  test('all items from a page that are older than limit cutoff are excluded', () => {
    const page = [
      item('1', T1),
      item('2', T2),
      item('3', T3),
      item('4', T4),
    ]
    const result = mergeLiveFeed([page], 2)
    expect(result.tweets.map(t => t.tweetId)).toEqual(['1', '2'])
    expect(result.nextCursorSk).toBe(`${T2}#2`)
  })

  test('works with generic type carrying extra fields', () => {
    interface ExtendedItem extends LiveFeedItem {
      text: string
    }
    const page: ExtendedItem[] = [
      { tweetId: 'x', createdAt: T1, text: 'hello' },
      { tweetId: 'y', createdAt: T2, text: 'world' },
    ]
    const result = mergeLiveFeed([page], 5)
    expect(result.tweets[0].text).toBe('hello')
    expect(result.tweets[1].text).toBe('world')
  })
})
