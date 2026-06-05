import { describe, it, expect } from 'vitest'
import { planNewsFanOut } from './news-fanout'
import { entryId } from '@monorepo-template/core/lib/feeds'
import type { NewsArticle } from '@monorepo-template/core/lib/news-relevance'

const FEED_HASH = 'test-feed-hash'
const INGESTED_AT = '2026-06-01T12:05:00.000Z'

function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    guid: 'guid-1',
    link: 'https://news.example/1',
    title: 'A neutral headline with no tickers',
    publishedAt: '2026-06-01T12:00:00.000Z',
    sourceName: 'Example News',
    ...overrides,
  }
}

describe('planNewsFanOut', () => {
  it('drops articles at or below the high-water mark', () => {
    const articles: NewsArticle[] = [
      makeArticle({
        guid: 'old',
        title: 'Bitcoin dips',
        publishedAt: '2026-06-01T09:00:00.000Z',
      }),
      makeArticle({
        guid: 'at-hw',
        title: 'Bitcoin steady',
        publishedAt: '2026-06-01T10:00:00.000Z', // exactly == high-water → dropped
      }),
    ]

    const plan = planNewsFanOut(articles, FEED_HASH, '2026-06-01T10:00:00.000Z', INGESTED_AT)
    expect(plan.items).toHaveLength(0)
    expect(plan.newHighWater).toBeUndefined()
  })

  it('emits one item per matched symbol, each carrying its relevanceScore', () => {
    const article = makeArticle({
      guid: 'btc-eth',
      title: 'Bitcoin and Ethereum rally as ETF inflows surge',
      summary: 'BTC and ETH both posted gains.',
      publishedAt: '2026-06-01T12:00:00.000Z',
    })

    const plan = planNewsFanOut([article], FEED_HASH, undefined, INGESTED_AT)

    const bySymbol = new Map(plan.items.map((i) => [i.symbol, i]))
    expect(bySymbol.has('BTC')).toBe(true)
    expect(bySymbol.has('ETH')).toBe(true)

    const eid = entryId(article.guid, article.link)
    for (const item of plan.items) {
      expect(item.kind).toBe('NEWS')
      expect(item.entryId).toBe(eid)
      expect(item.feedUrlHash).toBe(FEED_HASH)
      expect(item.ingestedAt).toBe(INGESTED_AT)
      expect(item.relevanceScore).toBeGreaterThanOrEqual(1)
      // relevanceScore mirrors the match score (count of distinct matched keywords).
      expect(typeof item.relevanceScore).toBe('number')
    }
  })

  it('advances newHighWater to the newest surviving article even when it matched nothing', () => {
    const articles: NewsArticle[] = [
      makeArticle({
        guid: 'matched',
        title: 'Bitcoin surges',
        publishedAt: '2026-06-01T12:00:00.000Z',
      }),
      makeArticle({
        guid: 'unmatched-newer',
        title: 'Local bakery wins regional award', // matches no token
        publishedAt: '2026-06-01T13:00:00.000Z',
      }),
    ]

    const plan = planNewsFanOut(articles, FEED_HASH, undefined, INGESTED_AT)

    // Only the matched article produced rows...
    expect(plan.items.length).toBeGreaterThanOrEqual(1)
    expect(plan.items.every((i) => i.guid === 'matched')).toBe(true)

    // ...but the high-water still advanced to the newest surviving (unmatched) article.
    expect(plan.newHighWater).toBe('2026-06-01T13:00:00.000Z')
  })
})
