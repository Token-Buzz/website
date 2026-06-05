/**
 * Statically-typed list of third-party crypto-news outlet RSS feeds.
 *
 * These are THIRD-PARTY NEWS sources (distinct from M13 first-party
 * pressFeedUrl project blogs). In M14 Phase 2 they are fetched once-per-cycle
 * and fanned out per token by relevance keywords (see CURATED_PRESS_SEED
 * newsKeywords in feed-seed.ts).
 *
 * ⚠️  Legal / ToS review is required before adding new outlets. Verify that
 * each outlet's RSS ToS permits programmatic consumption and redistribution of
 * headlines in this context before adding them to this list.
 */

export interface NewsOutletFeed {
  /** Human-readable publication name. */
  name: string
  /** Canonical homepage URL for the outlet. */
  homepageUrl: string
  /** RSS/Atom feed URL. Must be a stable, publicly accessible endpoint. */
  feedUrl: string
}

export const NEWS_OUTLET_FEEDS: NewsOutletFeed[] = [
  {
    name: 'CoinDesk',
    homepageUrl: 'https://www.coindesk.com',
    feedUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
  },
  {
    name: 'Cointelegraph',
    homepageUrl: 'https://cointelegraph.com',
    feedUrl: 'https://cointelegraph.com/rss',
  },
  {
    name: 'Decrypt',
    homepageUrl: 'https://decrypt.co',
    feedUrl: 'https://decrypt.co/feed',
  },
  {
    name: 'The Block',
    homepageUrl: 'https://www.theblock.co',
    feedUrl: 'https://www.theblock.co/rss.xml',
  },
]
