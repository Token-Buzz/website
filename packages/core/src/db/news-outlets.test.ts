import { describe, it, expect } from 'vitest'
import { NEWS_OUTLET_FEEDS } from './news-outlets'
import { CURATED_PRESS_SEED } from './feed-seed'

describe('NEWS_OUTLET_FEEDS', () => {
  it('has exactly 4 entries', () => {
    expect(NEWS_OUTLET_FEEDS).toHaveLength(4)
  })

  it('includes CoinDesk, Cointelegraph, Decrypt, and The Block', () => {
    const names = NEWS_OUTLET_FEEDS.map((o) => o.name)
    expect(names).toContain('CoinDesk')
    expect(names).toContain('Cointelegraph')
    expect(names).toContain('Decrypt')
    expect(names).toContain('The Block')
  })

  it('every feedUrl is a valid https:// URL', () => {
    for (const outlet of NEWS_OUTLET_FEEDS) {
      const parsed = new URL(outlet.feedUrl)
      expect(parsed.protocol, `feedUrl for ${outlet.name} should use https:`).toBe('https:')
    }
  })

  it('every homepageUrl is a valid https:// URL', () => {
    for (const outlet of NEWS_OUTLET_FEEDS) {
      const parsed = new URL(outlet.homepageUrl)
      expect(parsed.protocol, `homepageUrl for ${outlet.name} should use https:`).toBe('https:')
    }
  })

  it('outlet names are unique', () => {
    const names = NEWS_OUTLET_FEEDS.map((o) => o.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('feedUrls are unique', () => {
    const feedUrls = NEWS_OUTLET_FEEDS.map((o) => o.feedUrl)
    expect(new Set(feedUrls).size).toBe(feedUrls.length)
  })
})

describe('CURATED_PRESS_SEED newsKeywords', () => {
  const CURATED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'DOT', 'ADA', 'AVAX', 'LINK', 'UNI', 'AAVE', 'MKR', 'OP', 'ARB']

  // Symbols whose bare ticker is too generic to include (false-positive risk).
  const GENERIC_TICKER_SYMBOLS = ['SOL', 'DOT', 'ADA', 'LINK', 'UNI', 'OP', 'ARB']

  it('all 12 curated symbols have a non-empty newsKeywords array', () => {
    for (const symbol of CURATED_SYMBOLS) {
      const entry = CURATED_PRESS_SEED[symbol]
      expect(entry, `entry for ${symbol} should exist`).toBeDefined()
      expect(
        Array.isArray(entry.newsKeywords) && entry.newsKeywords.length > 0,
        `${symbol} should have a non-empty newsKeywords array`,
      ).toBe(true)
    }
  })

  it('generic-ticker symbols do NOT include the bare ticker in newsKeywords', () => {
    for (const symbol of GENERIC_TICKER_SYMBOLS) {
      const keywords = CURATED_PRESS_SEED[symbol].newsKeywords ?? []
      expect(
        keywords.includes(symbol),
        `${symbol} newsKeywords should NOT contain bare ticker "${symbol}" (false-positive risk)`,
      ).toBe(false)
    }
  })

  it('generic-ticker symbols DO include the $-prefixed ticker in newsKeywords', () => {
    for (const symbol of GENERIC_TICKER_SYMBOLS) {
      const keywords = CURATED_PRESS_SEED[symbol].newsKeywords ?? []
      expect(
        keywords.includes(`$${symbol}`),
        `${symbol} newsKeywords should contain "$${symbol}"`,
      ).toBe(true)
    }
  })
})
