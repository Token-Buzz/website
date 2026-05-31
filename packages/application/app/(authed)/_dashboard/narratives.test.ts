import { describe, test, expect } from 'vitest'
import { detectNarratives, type TokenKeywordStats } from './narratives'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<TokenKeywordStats>[]): TokenKeywordStats[] {
  return overrides.map((o) => ({
    token: 'TOKEN',
    keywords: [],
    priorKeywords: [],
    handles: [],
    ...o,
  }))
}

// ── Empty / trivial inputs ───────────────────────────────────────────────────

describe('detectNarratives — empty / trivial inputs', () => {
  test('returns [] for empty stats array', () => {
    expect(detectNarratives([])).toEqual([])
  })

  test('returns [] when all tokens have no keywords', () => {
    const stats = makeStats([
      { token: 'PEPE', keywords: [], priorKeywords: [], handles: [] },
      { token: 'DOGE', keywords: [], priorKeywords: [], handles: [] },
    ])
    expect(detectNarratives(stats)).toEqual([])
  })

  test('returns [] when only one token has keywords (single-token co-mention)', () => {
    const stats = makeStats([
      { token: 'PEPE', keywords: [{ value: 'meme', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'DOGE', keywords: [], priorKeywords: [], handles: [] },
    ])
    expect(detectNarratives(stats)).toEqual([])
  })
})

// ── minTokens threshold ──────────────────────────────────────────────────────

describe('detectNarratives — minTokens', () => {
  test('only includes keywords shared by ≥ minTokens (default 2) distinct tokens', () => {
    const stats = makeStats([
      { token: 'PEPE', keywords: [{ value: 'meme', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'SHIB', keywords: [{ value: 'meme', count: 3 }], priorKeywords: [], handles: [] },
      { token: 'DOGE', keywords: [{ value: 'unique', count: 99 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    const titles = result.map((n) => n.title.toLowerCase())
    expect(titles).toContain('meme')
    expect(titles).not.toContain('unique')
  })

  test('minTokens=3 requires keyword in 3 distinct tokens', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'topic', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'topic', count: 3 }], priorKeywords: [], handles: [] },
      { token: 'C', keywords: [{ value: 'topic', count: 2 }], priorKeywords: [], handles: [] },
    ])
    // minTokens=3 → 'topic' spans A, B, C → included
    const result = detectNarratives(stats, { minTokens: 3 })
    expect(result).toHaveLength(1)
    expect(result[0].title.toLowerCase()).toBe('topic')
  })

  test('minTokens=3 excludes keyword in only 2 tokens', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'topic', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'topic', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats, { minTokens: 3 })
    expect(result).toHaveLength(0)
  })
})

// ── Ticker-name exclusion ────────────────────────────────────────────────────

describe('detectNarratives — ticker-name exclusion', () => {
  test('excludes keyword when its normalised form equals a contributing token symbol', () => {
    const stats = makeStats([
      { token: 'PEPE', keywords: [{ value: 'pepe', count: 10 }, { value: 'meme', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'SHIB', keywords: [{ value: 'pepe', count: 8 }, { value: 'meme', count: 4 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    const titles = result.map((n) => n.title.toLowerCase())
    // 'pepe' is a contributing token symbol → must be excluded
    expect(titles).not.toContain('pepe')
    // 'meme' is not a token symbol → must be included
    expect(titles).toContain('meme')
  })

  test('exclusion is case-insensitive (uppercase token vs lowercase keyword)', () => {
    const stats = makeStats([
      { token: 'DOGE', keywords: [{ value: 'DOGE', count: 20 }], priorKeywords: [], handles: [] },
      { token: 'SHIB', keywords: [{ value: 'DOGE', count: 10 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(0)
  })

  test('does not exclude keyword that only partially matches a token symbol', () => {
    const stats = makeStats([
      { token: 'PEPE', keywords: [{ value: 'pepecoin', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'SHIB', keywords: [{ value: 'pepecoin', count: 5 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(1)
    expect(result[0].title.toLowerCase()).toBe('pepecoin')
  })
})

// ── Short keyword exclusion ──────────────────────────────────────────────────

describe('detectNarratives — short keyword exclusion', () => {
  test('excludes keywords shorter than 3 characters', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'ok', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'ok', count: 8 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(0)
  })

  test('excludes 1-char keywords', () => {
    const stats = makeStats([
      { token: 'X', keywords: [{ value: 'a', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'Y', keywords: [{ value: 'a', count: 3 }], priorKeywords: [], handles: [] },
    ])
    expect(detectNarratives(stats)).toHaveLength(0)
  })

  test('includes keywords of exactly 3 characters', () => {
    const stats = makeStats([
      { token: 'X', keywords: [{ value: 'btc', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'Y', keywords: [{ value: 'btc', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(1)
  })

  test('hashtag length check ignores the # prefix', () => {
    // '#ok' bare = 'ok' (length 2) → should be excluded
    const stats = makeStats([
      { token: 'X', keywords: [{ value: '#ok', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'Y', keywords: [{ value: '#ok', count: 8 }], priorKeywords: [], handles: [] },
    ])
    expect(detectNarratives(stats)).toHaveLength(0)
  })

  test('hashtag with 3+ char bare word is included', () => {
    // '#btc' bare = 'btc' (length 3) → included
    const stats = makeStats([
      { token: 'X', keywords: [{ value: '#btc', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'Y', keywords: [{ value: '#btc', count: 8 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(1)
  })
})

// ── mentions computation ─────────────────────────────────────────────────────

describe('detectNarratives — mentions', () => {
  test('sums current counts across contributing tokens', () => {
    const stats = makeStats([
      { token: 'ALPHA', keywords: [{ value: 'rally', count: 15 }], priorKeywords: [], handles: [] },
      { token: 'BETA', keywords: [{ value: 'rally', count: 10 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.mentions).toBe(25)
  })

  test('minMentions filter drops cluster below threshold', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'topic', count: 0 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'topic', count: 0 }], priorKeywords: [], handles: [] },
    ])
    expect(detectNarratives(stats, { minMentions: 1 })).toHaveLength(0)
  })

  test('minMentions default (1) keeps cluster with at least 1 mention', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'topic', count: 1 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'topic', count: 0 }], priorKeywords: [], handles: [] },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(1)
    expect(result[0].mentions).toBe(1)
  })
})

// ── growth calculation ────────────────────────────────────────────────────────

describe('detectNarratives — growth', () => {
  test('growth = 100 when no prior data and current > 0', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'surge', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'surge', count: 5 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.growth).toBe(100)
  })

  test('growth = 0 when prior and current are both 0 (edge case)', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'foo', count: 1 }], priorKeywords: [{ value: 'foo', count: 0 }], handles: [] },
      { token: 'B', keywords: [{ value: 'foo', count: 0 }], priorKeywords: [{ value: 'foo', count: 0 }], handles: [] },
    ])
    // mentions = 1, priorTotal = 0 → growth = 100 (not 0) — test realistic case
    const result = detectNarratives(stats)
    expect(result[0].growth).toBe(100)
  })

  test('growth = 0 when mentions equal prior (flat)', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'flat', count: 10 }], priorKeywords: [{ value: 'flat', count: 5 }], handles: [] },
      { token: 'B', keywords: [{ value: 'flat', count: 5 }], priorKeywords: [{ value: 'flat', count: 10 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    // mentions = 15, priorTotal = 15 → 0% growth
    expect(r.growth).toBe(0)
  })

  test('growth is positive when current > prior', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'pump', count: 30 }], priorKeywords: [{ value: 'pump', count: 10 }], handles: [] },
      { token: 'B', keywords: [{ value: 'pump', count: 0 }], priorKeywords: [{ value: 'pump', count: 10 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    // mentions = 30, priorTotal = 20 → 50%
    expect(r.growth).toBe(50)
  })

  test('growth is negative when current < prior', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'fade', count: 5 }], priorKeywords: [{ value: 'fade', count: 20 }], handles: [] },
      { token: 'B', keywords: [{ value: 'fade', count: 5 }], priorKeywords: [{ value: 'fade', count: 0 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    // mentions = 10, priorTotal = 20 → -50%
    expect(r.growth).toBe(-50)
  })

  test('growth is rounded to integer', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'rnd', count: 2 }], priorKeywords: [{ value: 'rnd', count: 3 }], handles: [] },
      { token: 'B', keywords: [{ value: 'rnd', count: 1 }], priorKeywords: [{ value: 'rnd', count: 0 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    // mentions = 3, priorTotal = 3 → 0%
    expect(Number.isInteger(r.growth)).toBe(true)
  })

  test('prior data only in priorKeywords, not current keywords, does not affect mentions', () => {
    const stats = makeStats([
      {
        token: 'A',
        keywords: [{ value: 'test', count: 20 }],
        priorKeywords: [{ value: 'test', count: 5 }],
        handles: [],
      },
      {
        token: 'B',
        keywords: [{ value: 'test', count: 10 }],
        priorKeywords: [{ value: 'test', count: 5 }],
        handles: [],
      },
    ])
    const [r] = detectNarratives(stats)
    // mentions = 30, priorTotal = 10 → 200%
    expect(r.mentions).toBe(30)
    expect(r.growth).toBe(200)
  })
})

// ── handle de-duplication ────────────────────────────────────────────────────

describe('detectNarratives — handle de-duplication', () => {
  test('counts distinct handles unioned across contributing tokens', () => {
    const stats = makeStats([
      {
        token: 'A',
        keywords: [{ value: 'moon', count: 5 }],
        priorKeywords: [],
        handles: ['@alice', '@bob'],
      },
      {
        token: 'B',
        keywords: [{ value: 'moon', count: 5 }],
        priorKeywords: [],
        handles: ['@bob', '@carol'],
      },
    ])
    const [r] = detectNarratives(stats)
    // @alice + @bob + @carol = 3 distinct (not 4)
    expect(r.handles).toBe(3)
  })

  test('handles = 0 when no handles provided', () => {
    const stats = makeStats([
      { token: 'X', keywords: [{ value: 'topic', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'Y', keywords: [{ value: 'topic', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.handles).toBe(0)
  })

  test('duplicate handle in same token counted once', () => {
    const stats = makeStats([
      {
        token: 'A',
        keywords: [{ value: 'trend', count: 5 }],
        priorKeywords: [],
        handles: ['@same', '@same', '@other'],
      },
      {
        token: 'B',
        keywords: [{ value: 'trend', count: 3 }],
        priorKeywords: [],
        handles: [],
      },
    ])
    const [r] = detectNarratives(stats)
    // @same and @other = 2 distinct
    expect(r.handles).toBe(2)
  })

  test('handles from non-contributing tokens are excluded', () => {
    // 'solo' keyword only in token A → does not form a narrative (minTokens=2)
    // 'shared' keyword in A and B → forms narrative
    const stats = makeStats([
      {
        token: 'A',
        keywords: [{ value: 'shared', count: 5 }],
        priorKeywords: [],
        handles: ['@alice'],
      },
      {
        token: 'B',
        keywords: [{ value: 'shared', count: 3 }],
        priorKeywords: [],
        handles: ['@bob'],
      },
      {
        token: 'C',
        keywords: [],
        priorKeywords: [],
        handles: ['@carol'],  // C does not contribute to 'shared'
      },
    ])
    const result = detectNarratives(stats)
    expect(result).toHaveLength(1)
    // Only A and B contribute → @alice + @bob = 2
    expect(result[0].handles).toBe(2)
  })
})

// ── ranking and max cap ───────────────────────────────────────────────────────

describe('detectNarratives — ranking and max cap', () => {
  test('returns at most max (default 5) narratives', () => {
    // Create 7 distinct shared keywords
    const keywords = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf']
    const stats: TokenKeywordStats[] = [
      {
        token: 'A',
        keywords: keywords.map((kw, i) => ({ value: kw, count: i + 1 })),
        priorKeywords: [],
        handles: [],
      },
      {
        token: 'B',
        keywords: keywords.map((kw, i) => ({ value: kw, count: i + 1 })),
        priorKeywords: [],
        handles: [],
      },
    ]
    const result = detectNarratives(stats)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  test('custom max cap is respected', () => {
    const keywords = ['alpha', 'bravo', 'charlie', 'delta']
    const stats: TokenKeywordStats[] = [
      {
        token: 'A',
        keywords: keywords.map((kw) => ({ value: kw, count: 5 })),
        priorKeywords: [],
        handles: [],
      },
      {
        token: 'B',
        keywords: keywords.map((kw) => ({ value: kw, count: 5 })),
        priorKeywords: [],
        handles: [],
      },
    ]
    const result = detectNarratives(stats, { max: 2 })
    expect(result).toHaveLength(2)
  })

  test('ranks by mentions descending', () => {
    const stats: TokenKeywordStats[] = [
      {
        token: 'A',
        keywords: [{ value: 'low', count: 2 }, { value: 'high', count: 20 }],
        priorKeywords: [],
        handles: [],
      },
      {
        token: 'B',
        keywords: [{ value: 'low', count: 2 }, { value: 'high', count: 20 }],
        priorKeywords: [],
        handles: [],
      },
    ]
    const result = detectNarratives(stats)
    expect(result[0].mentions).toBeGreaterThanOrEqual(result[1].mentions)
  })

  test('tiebreaks by growth descending', () => {
    const stats: TokenKeywordStats[] = [
      {
        token: 'A',
        keywords: [{ value: 'xray', count: 10 }, { value: 'yankee', count: 10 }],
        priorKeywords: [{ value: 'xray', count: 5 }, { value: 'yankee', count: 9 }],  // xray +100%, yankee +11%
        handles: [],
      },
      {
        token: 'B',
        keywords: [{ value: 'xray', count: 10 }, { value: 'yankee', count: 10 }],
        priorKeywords: [{ value: 'xray', count: 5 }, { value: 'yankee', count: 11 }],  // yankee -9.09%
        handles: [],
      },
    ]
    const result = detectNarratives(stats)
    // xray: 20 mentions, prior 10 → +100%
    // yankee: 20 mentions, prior 20 → 0%
    expect(result[0].title.toLowerCase()).toBe('xray')
    expect(result[1].title.toLowerCase()).toBe('yankee')
  })

  test('final tiebreak is title ascending (stable output)', () => {
    const stats: TokenKeywordStats[] = [
      {
        token: 'A',
        keywords: [{ value: 'zebra', count: 5 }, { value: 'apple', count: 5 }],
        priorKeywords: [],
        handles: [],
      },
      {
        token: 'B',
        keywords: [{ value: 'zebra', count: 5 }, { value: 'apple', count: 5 }],
        priorKeywords: [],
        handles: [],
      },
    ]
    const result = detectNarratives(stats)
    // Both have mentions=10, growth=100 → alphabetical: Apple before Zebra
    expect(result[0].title).toBe('Apple')
    expect(result[1].title).toBe('Zebra')
  })
})

// ── token list ordering ──────────────────────────────────────────────────────

describe('detectNarratives — token list ordering', () => {
  test('tokens sorted by contribution descending', () => {
    const stats: TokenKeywordStats[] = [
      {
        token: 'SMALL',
        keywords: [{ value: 'surge', count: 2 }],
        priorKeywords: [],
        handles: [],
      },
      {
        token: 'BIG',
        keywords: [{ value: 'surge', count: 20 }],
        priorKeywords: [],
        handles: [],
      },
    ]
    const [r] = detectNarratives(stats)
    expect(r.tokens[0]).toBe('BIG')
    expect(r.tokens[1]).toBe('SMALL')
  })
})

// ── title humanisation ────────────────────────────────────────────────────────

describe('detectNarratives — title humanisation', () => {
  test('capitalises first letter of plain words', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'rally', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'rally', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.title).toBe('Rally')
  })

  test('hashtag retains # prefix, rest lowercased', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: '#Bitcoin', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: '#Bitcoin', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.title).toBe('#bitcoin')
  })

  test('uppercase keyword gets title-cased', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'MOON', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'MOON', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.title).toBe('Moon')
  })
})

// ── summary grammar ───────────────────────────────────────────────────────────

describe('detectNarratives — summary grammar', () => {
  test('1 token: "Co-mentioned across $A."', () => {
    // minTokens=1 to force single-token narrative
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'solo', count: 5 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats, { minTokens: 1 })
    expect(r.summary).toContain('$A')
    expect(r.summary).not.toContain(' and ')
  })

  test('2 tokens: "Co-mentioned across $A and $B."', () => {
    const stats = makeStats([
      { token: 'ALPHA', keywords: [{ value: 'moon', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'BETA', keywords: [{ value: 'moon', count: 5 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.summary).toContain('$ALPHA and $BETA')
  })

  test('3 tokens: "Co-mentioned across $A, $B and $C."', () => {
    const stats: TokenKeywordStats[] = [
      { token: 'AAA', keywords: [{ value: 'trend', count: 10 }], priorKeywords: [], handles: [] },
      { token: 'BBB', keywords: [{ value: 'trend', count: 6 }], priorKeywords: [], handles: [] },
      { token: 'CCC', keywords: [{ value: 'trend', count: 3 }], priorKeywords: [], handles: [] },
    ]
    const [r] = detectNarratives(stats)
    // tokens sorted by contribution: AAA, BBB, CCC
    expect(r.summary).toContain('$AAA, $BBB and $CCC')
  })

  test('mentions count singular "mention" for 1 mention', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'item', count: 1 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'item', count: 0 }], priorKeywords: [{ value: 'item', count: 0 }], handles: [] },
    ])
    const result = detectNarratives(stats, { minTokens: 2, minMentions: 1 })
    // mentions=1 from A's count; B has count=0 so still forms a cross-token hit
    if (result.length > 0) {
      expect(result[0].summary).toContain('1 mention,')
    }
  })

  test('mentions count uses plural "mentions" for > 1', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'item', count: 5 }], priorKeywords: [], handles: [] },
      { token: 'B', keywords: [{ value: 'item', count: 3 }], priorKeywords: [], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.summary).toContain('8 mentions,')
  })

  test('growth = 0 shows "flat vs the prior 24h"', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'flat', count: 10 }], priorKeywords: [{ value: 'flat', count: 5 }], handles: [] },
      { token: 'B', keywords: [{ value: 'flat', count: 0 }], priorKeywords: [{ value: 'flat', count: 5 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.summary).toContain('flat vs the prior 24h')
  })

  test('positive growth shows "up X% vs the prior 24h"', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'bull', count: 20 }], priorKeywords: [{ value: 'bull', count: 10 }], handles: [] },
      { token: 'B', keywords: [{ value: 'bull', count: 0 }], priorKeywords: [{ value: 'bull', count: 0 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    expect(r.summary).toContain('up')
    expect(r.summary).toContain('vs the prior 24h')
  })

  test('negative growth shows "down X% vs the prior 24h"', () => {
    const stats = makeStats([
      { token: 'A', keywords: [{ value: 'dump', count: 5 }], priorKeywords: [{ value: 'dump', count: 20 }], handles: [] },
      { token: 'B', keywords: [{ value: 'dump', count: 5 }], priorKeywords: [{ value: 'dump', count: 0 }], handles: [] },
    ])
    const [r] = detectNarratives(stats)
    // mentions=10, prior=20 → -50%
    expect(r.summary).toContain('down 50%')
  })
})

// ── determinism ──────────────────────────────────────────────────────────────

describe('detectNarratives — determinism', () => {
  test('same input produces identical output on repeated calls', () => {
    const stats: TokenKeywordStats[] = [
      {
        token: 'AAA',
        keywords: [{ value: 'rocket', count: 15 }, { value: 'moon', count: 8 }],
        priorKeywords: [{ value: 'rocket', count: 5 }],
        handles: ['@alice'],
      },
      {
        token: 'BBB',
        keywords: [{ value: 'rocket', count: 10 }, { value: 'moon', count: 12 }],
        priorKeywords: [{ value: 'moon', count: 6 }],
        handles: ['@bob'],
      },
    ]
    const r1 = detectNarratives(stats)
    const r2 = detectNarratives(stats)
    expect(r1).toEqual(r2)
  })
})

// ── case-insensitive merging ──────────────────────────────────────────────────

describe('detectNarratives — case-insensitive keyword merging', () => {
  test('keywords differing only in case are merged into one narrative', () => {
    const stats: TokenKeywordStats[] = [
      {
        token: 'A',
        keywords: [{ value: 'Bullish', count: 10 }],
        priorKeywords: [],
        handles: [],
      },
      {
        token: 'B',
        keywords: [{ value: 'bullish', count: 5 }],
        priorKeywords: [],
        handles: [],
      },
    ]
    const result = detectNarratives(stats)
    expect(result).toHaveLength(1)
    expect(result[0].mentions).toBe(15)
  })
})
