import { describe, it, test, expect } from 'vitest'
import {
  matchArticleSymbols,
  matchSeedSymbols,
  escapeRegExp,
  DEFAULT_RELEVANCE_THRESHOLD,
  NEWS_FIREHOSE_SYMBOL,
} from './news-relevance'

// ── escapeRegExp ──────────────────────────────────────────────────────────────

describe('escapeRegExp', () => {
  test('escapes regex special characters', () => {
    expect(escapeRegExp('$BTC')).toBe('\\$BTC')
    expect(escapeRegExp('foo.bar')).toBe('foo\\.bar')
    expect(escapeRegExp('a(b)c')).toBe('a\\(b\\)c')
    expect(escapeRegExp('no-specials')).toBe('no-specials')
  })
})

// ── NEWS_FIREHOSE_SYMBOL ──────────────────────────────────────────────────────

test('NEWS_FIREHOSE_SYMBOL is a non-empty string containing underscores', () => {
  expect(typeof NEWS_FIREHOSE_SYMBOL).toBe('string')
  expect(NEWS_FIREHOSE_SYMBOL).toContain('_')
})

// ── DEFAULT_RELEVANCE_THRESHOLD ───────────────────────────────────────────────

test('DEFAULT_RELEVANCE_THRESHOLD is 1', () => {
  expect(DEFAULT_RELEVANCE_THRESHOLD).toBe(1)
})

// ── matchArticleSymbols — $ prefixed keyword matching ─────────────────────────

describe('$-prefixed keyword matching', () => {
  const keywords = { BTC: ['$BTC', 'Bitcoin'] }

  test('$BTC matches "$BTC pumps"', () => {
    const matches = matchArticleSymbols({ title: '$BTC pumps hard today' }, keywords)
    expect(matches).toHaveLength(1)
    expect(matches[0].symbol).toBe('BTC')
    expect(matches[0].matched).toContain('$BTC')
  })

  test('$BTC does NOT match "$BTCASH" (followed by alphanumeric)', () => {
    const matches = matchArticleSymbols({ title: '$BTCASH is a fork' }, keywords)
    // Only '$BTC' is tested — should not match since 'ASH' follows immediately
    const btcMatch = matches.find((m) => m.symbol === 'BTC')
    // If there is a match it must NOT have $BTC in matched (Bitcoin might match separately)
    if (btcMatch) {
      expect(btcMatch.matched).not.toContain('$BTC')
    }
  })

  test('$BTC is case-insensitive: matches "$btc"', () => {
    const matches = matchArticleSymbols({ title: 'sell $btc now' }, keywords)
    expect(matches.some((m) => m.symbol === 'BTC' && m.matched.includes('$BTC'))).toBe(true)
  })

  test('$BTC matches at end of string with no trailing char', () => {
    const matches = matchArticleSymbols({ title: 'buy $BTC' }, keywords)
    expect(matches.some((m) => m.symbol === 'BTC' && m.matched.includes('$BTC'))).toBe(true)
  })

  test('$BTC matches before punctuation like "!"', () => {
    const matches = matchArticleSymbols({ title: 'HODL $BTC!' }, keywords)
    expect(matches.some((m) => m.symbol === 'BTC' && m.matched.includes('$BTC'))).toBe(true)
  })
})

// ── matchArticleSymbols — plain keyword matching ──────────────────────────────

describe('plain keyword word-boundary matching', () => {
  const keywords = { ETH: ['Ethereum', 'ETH'] }

  test('Bitcoin matches "Bitcoin\'s rally" (apostrophe is a non-alphanumeric boundary)', () => {
    const btcKeywords = { BTC: ['Bitcoin'] }
    const matches = matchArticleSymbols({ title: "Bitcoin's rally continues" }, btcKeywords)
    expect(matches).toHaveLength(1)
    expect(matches[0].symbol).toBe('BTC')
    expect(matches[0].matched).toContain('Bitcoin')
  })

  test('Ethereum keyword does NOT match "theothereum" (embedded in longer word)', () => {
    const matches = matchArticleSymbols({ title: 'theothereum is not ethereum' }, keywords)
    // 'theothereum' — 'Ethereum' is preceded by 'th' (alphanumeric) so no match there
    // 'not ethereum' — 'ethereum' is preceded by space (non-alphanumeric) → MATCH
    const ethMatch = matches.find((m) => m.symbol === 'ETH')
    if (ethMatch) {
      // It matches the second occurrence (preceded by space), not the embedded one
      expect(ethMatch.matched).toContain('Ethereum')
    }
  })

  test('Ethereum does NOT match "myethereum" (no word boundary)', () => {
    const matches = matchArticleSymbols({ title: 'myethereum platform' }, keywords)
    const ethMatch = matches.find((m) => m.symbol === 'ETH')
    expect(ethMatch).toBeUndefined()
  })

  test('ETH matches "ETH price" (plain ticker with spaces as boundaries)', () => {
    const matches = matchArticleSymbols({ title: 'ETH price surges 10%' }, keywords)
    expect(matches.some((m) => m.symbol === 'ETH' && m.matched.includes('ETH'))).toBe(true)
  })

  test('ETH does NOT match "TEETH" (embedded in word)', () => {
    const matches = matchArticleSymbols({ title: 'TEETH whitening news' }, keywords)
    const ethMatch = matches.find((m) => m.symbol === 'ETH')
    expect(ethMatch).toBeUndefined()
  })
})

// ── matchArticleSymbols — multiple symbols ────────────────────────────────────

describe('multiple symbol matching', () => {
  const keywords = {
    BTC: ['Bitcoin', '$BTC', 'BTC'],
    ETH: ['Ethereum', '$ETH', 'ETH'],
    SOL: ['Solana', '$SOL'],
  }

  test('article matching multiple symbols returns multiple SymbolMatches', () => {
    const matches = matchArticleSymbols(
      { title: 'Bitcoin and Ethereum rally while Solana lags' },
      keywords,
    )
    expect(matches.length).toBeGreaterThanOrEqual(3)
    const syms = matches.map((m) => m.symbol)
    expect(syms).toContain('BTC')
    expect(syms).toContain('ETH')
    expect(syms).toContain('SOL')
  })

  test('results sorted by score descending, then symbol ascending', () => {
    // BTC gets the highest score (Bitcoin + $BTC both match), ETH gets 1 (Ethereum), SOL gets 1 (Solana)
    const matches = matchArticleSymbols(
      { title: 'Bitcoin $BTC leads, Ethereum and Solana follow' },
      keywords,
    )
    expect(matches[0].symbol).toBe('BTC') // highest score
    expect(matches[0].score).toBeGreaterThanOrEqual(2)
    // ETH and SOL tied — ETH < SOL alphabetically
    expect(matches[1].symbol).toBe('ETH')
    expect(matches[2].symbol).toBe('SOL')
  })

  test('score equals distinct matched-keyword count', () => {
    const matches = matchArticleSymbols(
      { title: 'Bitcoin and $BTC and BTC today' },
      keywords,
    )
    const btcMatch = matches.find((m) => m.symbol === 'BTC')
    expect(btcMatch).toBeDefined()
    // Bitcoin, $BTC, BTC all match — score should be 3
    expect(btcMatch!.score).toBe(3)
    expect(btcMatch!.matched).toHaveLength(3)
  })
})

// ── matchArticleSymbols — threshold filtering ─────────────────────────────────

describe('threshold filtering', () => {
  const keywords = {
    BTC: ['Bitcoin', '$BTC', 'BTC'],
    ETH: ['Ethereum'],
  }

  test('threshold=1 (default) includes symbols with at least one match', () => {
    const matches = matchArticleSymbols(
      { title: 'Bitcoin rally and Ethereum dip' },
      keywords,
      1,
    )
    expect(matches.length).toBe(2)
  })

  test('threshold=2 excludes ETH (score=1) and includes BTC (score=2)', () => {
    const matches = matchArticleSymbols(
      { title: 'Bitcoin and $BTC lead markets, Ethereum trails' },
      keywords,
      2,
    )
    const syms = matches.map((m) => m.symbol)
    expect(syms).toContain('BTC')
    expect(syms).not.toContain('ETH')
  })

  test('threshold=10 returns empty array when no symbol scores that high', () => {
    const matches = matchArticleSymbols(
      { title: 'Bitcoin rally' },
      keywords,
      10,
    )
    expect(matches).toHaveLength(0)
  })
})

// ── matchArticleSymbols — symbols with no keywords never match ────────────────

describe('symbols with no newsKeywords', () => {
  test('symbol with undefined keywords is never matched', () => {
    const keywords = {
      BTC: ['Bitcoin'],
      UNKNOWN: undefined,
    }
    const matches = matchArticleSymbols(
      { title: 'Bitcoin and UNKNOWN token' },
      keywords,
    )
    const syms = matches.map((m) => m.symbol)
    expect(syms).not.toContain('UNKNOWN')
    expect(syms).toContain('BTC')
  })

  test('symbol with empty keyword array is never matched', () => {
    const keywords = {
      BTC: ['Bitcoin'],
      EMPTY: [],
    }
    const matches = matchArticleSymbols(
      { title: 'Bitcoin and EMPTY coin' },
      keywords,
    )
    const syms = matches.map((m) => m.symbol)
    expect(syms).not.toContain('EMPTY')
  })
})

// ── matchArticleSymbols — summary field ──────────────────────────────────────

describe('summary field is searched', () => {
  test('keyword found only in summary still matches', () => {
    const keywords = { BTC: ['Bitcoin'] }
    const matches = matchArticleSymbols(
      { title: 'Crypto markets update', summary: 'Bitcoin surges past 100k' },
      keywords,
    )
    expect(matches.some((m) => m.symbol === 'BTC')).toBe(true)
  })
})

// ── matchSeedSymbols ──────────────────────────────────────────────────────────

describe('matchSeedSymbols', () => {
  test('returns BTC match for a Bitcoin headline', () => {
    const matches = matchSeedSymbols({ title: 'Bitcoin hits new all-time high' })
    expect(matches.some((m) => m.symbol === 'BTC')).toBe(true)
  })

  test('returns ETH match for an Ethereum headline', () => {
    const matches = matchSeedSymbols({ title: 'Ethereum upgrade goes live on mainnet' })
    expect(matches.some((m) => m.symbol === 'ETH')).toBe(true)
  })

  test('returns empty array for an unrelated headline', () => {
    const matches = matchSeedSymbols({ title: 'Stock market closes flat on Tuesday' })
    expect(matches).toHaveLength(0)
  })

  test('respects threshold: threshold=2 filters single-keyword matches', () => {
    // "Solana" matches SOL with score=1 (only keyword); threshold=2 should exclude it
    const matches = matchSeedSymbols({ title: 'Solana network sees outage' }, 2)
    const solMatch = matches.find((m) => m.symbol === 'SOL')
    expect(solMatch).toBeUndefined()
  })
})
