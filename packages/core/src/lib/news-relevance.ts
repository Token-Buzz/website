// Pure relevance-matching logic for news articles against token keyword sets.
// No DB or network calls — fully testable offline.

import { CURATED_PRESS_SEED } from '../db/feed-seed'

/**
 * Sentinel symbol used for firehose poll-cursor rows.
 * Real ticker symbols never contain underscores, so there is no collision risk.
 */
export const NEWS_FIREHOSE_SYMBOL = '__NEWS__'

export interface NewsArticle {
  guid: string
  link: string
  title: string
  summary?: string
  publishedAt: string // ISO-8601
  sourceName: string
}

export interface SymbolMatch {
  symbol: string    // UPPERCASE
  score: number     // count of distinct matched keywords
  matched: string[] // the keywords that matched
}

/** Minimum score for a symbol to be included in results. */
export const DEFAULT_RELEVANCE_THRESHOLD = 1

/** Escapes all RegExp special characters in a string. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Matches a single news article against a map of symbols → keyword lists.
 *
 * Matching rules (designed to minimise false positives for short tickers):
 *   - Keywords starting with `$` (e.g. `$BTC`): match literal `$` + ticker body,
 *     case-insensitive, NOT immediately followed by an alphanumeric character.
 *   - Plain keywords (e.g. `Bitcoin`, `BTC`, `MakerDAO`): word-boundary match via
 *     lookbehind/lookahead non-alphanumeric guards, case-insensitive.
 *
 * Returns symbols whose distinct-keyword score >= threshold, sorted by score
 * descending then symbol ascending. Symbols with no/empty newsKeywords never match.
 */
export function matchArticleSymbols(
  article: { title: string; summary?: string },
  keywordsBySymbol: Record<string, string[] | undefined>,
  threshold = DEFAULT_RELEVANCE_THRESHOLD,
): SymbolMatch[] {
  const text = article.title + ' ' + (article.summary ?? '')

  const results: SymbolMatch[] = []

  for (const [symbol, keywords] of Object.entries(keywordsBySymbol)) {
    if (!keywords || keywords.length === 0) continue

    const matched: string[] = []

    for (const keyword of keywords) {
      let pattern: RegExp
      if (keyword.startsWith('$')) {
        // $BTC → match $BTC not followed by alphanumeric
        const escaped = escapeRegExp(keyword)
        pattern = new RegExp(`${escaped}(?![A-Za-z0-9])`, 'i')
      } else {
        // Plain keyword → word-boundary via non-alphanumeric guards
        const escaped = escapeRegExp(keyword)
        pattern = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i')
      }

      if (pattern.test(text)) {
        matched.push(keyword)
      }
    }

    const score = matched.length
    if (score >= threshold) {
      results.push({ symbol, score, matched })
    }
  }

  // Sort by score descending, then symbol ascending
  results.sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))

  return results
}

/**
 * Convenience wrapper that matches against all symbols in CURATED_PRESS_SEED.
 * Builds the keyword map from `entry.newsKeywords` for each symbol.
 */
export function matchSeedSymbols(
  article: { title: string; summary?: string },
  threshold = DEFAULT_RELEVANCE_THRESHOLD,
): SymbolMatch[] {
  const keywordsBySymbol: Record<string, string[] | undefined> = {}
  for (const [symbol, entry] of Object.entries(CURATED_PRESS_SEED)) {
    keywordsBySymbol[symbol] = entry.newsKeywords
  }
  return matchArticleSymbols(article, keywordsBySymbol, threshold)
}
