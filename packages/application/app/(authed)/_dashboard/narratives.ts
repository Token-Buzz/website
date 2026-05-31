/**
 * Pure, deterministic narrative-detection module.
 * No framework dependencies — fully unit-testable.
 *
 * A "narrative" is a keyword co-mentioned across multiple tracked tokens within
 * a time window. Detecting keywords that appear across several watchlist tokens
 * surfaces emerging cross-asset themes without requiring an LLM.
 */

export interface TokenKeywordStats {
  /** Symbol / query string (e.g. "PEPE", "solana") */
  token: string
  /** Top keywords for the current window */
  keywords: { value: string; count: number }[]
  /** Top keywords for the prior window (used for growth calculation) */
  priorKeywords: { value: string; count: number }[]
  /** Distinct @mention handles extracted from the current window */
  handles: string[]
}

export interface DetectedNarrative {
  /** Clean, human-readable topic title */
  title: string
  /** Sum of current keyword counts across contributing tokens */
  mentions: number
  /** Growth vs the prior window, as an integer percentage */
  growth: number
  /** Contributing token symbols, sorted by contribution descending */
  tokens: string[]
  /** Count of distinct @mention handles across contributing tokens */
  handles: number
  /** Factual, templated summary sentence derived only from the numbers */
  summary: string
}

interface NarrativeOpts {
  /** Minimum number of distinct tokens a keyword must appear in (default 2) */
  minTokens?: number
  /** Minimum total mention count (default 1) */
  minMentions?: number
  /** Maximum narratives to return (default 5) */
  max?: number
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Normalise a keyword to lowercase for index lookups.
 * Hashtags retain their '#' prefix.
 */
function normalise(kw: string): string {
  return kw.toLowerCase().trim()
}

/**
 * Produce a display-ready title from a raw keyword:
 * - Hashtags keep their '#' prefix, rest of word is lower-cased.
 * - Plain words get their first letter capitalised.
 */
function humanise(kw: string): string {
  const w = kw.trim()
  if (w.startsWith('#')) {
    return '#' + w.slice(1).toLowerCase()
  }
  if (!w.length) return w
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}

/**
 * Build a factual summary sentence for a detected narrative.
 * Grammar adapts for 1, 2, or 3+ tokens.
 * No fabricated qualitative claims — only numbers.
 */
function buildSummary(
  tokens: string[],
  mentions: number,
  growth: number,
): string {
  const tickers =
    tokens.length === 1
      ? `$${tokens[0]}`
      : tokens.length === 2
        ? `$${tokens[0]} and $${tokens[1]}`
        : `${tokens.slice(0, -1).map((t) => `$${t}`).join(', ')}` +
          ` and $${tokens[tokens.length - 1]}`

  const direction = growth >= 0 ? 'up' : 'down'
  const growthAbs = Math.abs(growth)
  const growthStr =
    growth === 0
      ? 'flat vs the prior 24h'
      : `${direction} ${growthAbs}% vs the prior 24h`

  return `Co-mentioned across ${tickers}. ${mentions} mention${mentions === 1 ? '' : 's'}, ${growthStr}.`
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect emerging cross-token narratives from pre-fetched keyword stats.
 *
 * Algorithm:
 * 1. Build an inverted index: lowercase-keyword → per-token current/prior counts.
 * 2. Keep only keywords that appear in ≥ minTokens distinct tokens.
 * 3. Exclude keywords whose normalised form equals a contributing token symbol
 *    (avoids a ticker appearing as its own narrative).
 * 4. Exclude very short keywords (length < 3, ignoring leading '#').
 * 5. Compute mentions, growth, tokens, handles, title, summary per cluster.
 * 6. Drop clusters below minMentions.
 * 7. Rank by mentions desc, then growth desc, then title asc (stable output).
 * 8. Return top `max` results.
 */
export function detectNarratives(
  stats: TokenKeywordStats[],
  opts: NarrativeOpts = {},
): DetectedNarrative[] {
  const {
    minTokens = 2,
    minMentions = 1,
    max = 5,
  } = opts

  // Step 1 – inverted index
  // Map: normalised keyword → Map<token, { current, prior }>
  type TokenContrib = { current: number; prior: number }
  const index = new Map<string, Map<string, TokenContrib>>()

  for (const stat of stats) {
    const tokenNorm = normalise(stat.token)

    for (const kw of stat.keywords) {
      const key = normalise(kw.value)
      if (!index.has(key)) index.set(key, new Map())
      const bucket = index.get(key)!
      const existing = bucket.get(tokenNorm) ?? { current: 0, prior: 0 }
      bucket.set(tokenNorm, { ...existing, current: existing.current + kw.count })
    }

    for (const kw of stat.priorKeywords) {
      const key = normalise(kw.value)
      if (!index.has(key)) index.set(key, new Map())
      const bucket = index.get(key)!
      const existing = bucket.get(tokenNorm) ?? { current: 0, prior: 0 }
      bucket.set(tokenNorm, { ...existing, prior: existing.prior + kw.count })
    }
  }

  // Build a map from normalised token → original casing for display
  const tokenCasing = new Map<string, string>()
  for (const stat of stats) {
    tokenCasing.set(normalise(stat.token), stat.token)
  }

  // Build a map from normalised token → handles set
  const tokenHandles = new Map<string, Set<string>>()
  for (const stat of stats) {
    tokenHandles.set(normalise(stat.token), new Set(stat.handles))
  }

  const results: DetectedNarrative[] = []

  for (const [kwNorm, tokenMap] of index.entries()) {
    // Step 2 – co-mention threshold
    if (tokenMap.size < minTokens) continue

    // Step 4 – short keyword filter (strip leading '#' before checking length)
    const bareKw = kwNorm.startsWith('#') ? kwNorm.slice(1) : kwNorm
    if (bareKw.length < 3) continue

    // Step 3 – exclude keyword == contributing token symbol
    const contributingTokenNorms = Array.from(tokenMap.keys())
    if (contributingTokenNorms.includes(kwNorm)) continue

    // Step 5a – aggregate mentions + prior totals
    let mentions = 0
    let priorTotal = 0
    const contributions: Array<{ tokenNorm: string; current: number }> = []

    for (const [tokenNorm, contrib] of tokenMap.entries()) {
      mentions += contrib.current
      priorTotal += contrib.prior
      contributions.push({ tokenNorm, current: contrib.current })
    }

    // Step 6 – min mentions filter
    if (mentions < minMentions) continue

    // Step 5b – growth
    const growth =
      priorTotal > 0
        ? Math.round(((mentions - priorTotal) / priorTotal) * 100)
        : mentions > 0
          ? 100
          : 0

    // Step 5c – token list sorted by contribution desc
    contributions.sort((a, b) => b.current - a.current)
    const tokens = contributions.map((c) => tokenCasing.get(c.tokenNorm) ?? c.tokenNorm)

    // Step 5d – handles: union of distinct handles across contributing tokens
    const allHandles = new Set<string>()
    for (const { tokenNorm } of contributions) {
      const h = tokenHandles.get(tokenNorm)
      if (h) h.forEach((handle) => allHandles.add(handle))
    }

    // Step 5e/f – title + summary
    // Find the original-casing keyword from the first stat that has it
    let originalKw = kwNorm
    for (const stat of stats) {
      const found = stat.keywords.find((k) => normalise(k.value) === kwNorm)
      if (found) { originalKw = found.value; break }
    }
    const title = humanise(originalKw)
    const summary = buildSummary(tokens, mentions, growth)

    results.push({
      title,
      mentions,
      growth,
      tokens,
      handles: allHandles.size,
      summary,
    })
  }

  // Step 7 – rank: mentions desc, growth desc, title asc
  results.sort((a, b) => {
    if (b.mentions !== a.mentions) return b.mentions - a.mentions
    if (b.growth !== a.growth) return b.growth - a.growth
    return a.title.localeCompare(b.title)
  })

  // Step 8 – cap
  return results.slice(0, max)
}
