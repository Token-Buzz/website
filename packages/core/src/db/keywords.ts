// Uses node-rake (MIT) — MIT-licensed NodeJS RAKE implementation, more actively
// maintained than rake-js (LGPL). API: require('node-rake').generate(text).
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rake = require('node-rake') as { generate: (text: string, opts?: { stopwords?: string[] }) => string[] }

/**
 * Extracts keywords from `text` using the RAKE algorithm.
 * Returns up to `opts.max` unique lowercase keywords of length ≥ 3,
 * sorted by RAKE score (highest first).
 */
export function extractKeywords(text: string, opts?: { max?: number }): string[] {
  if (!text || !text.trim()) return []

  const max = opts?.max ?? 10

  let raw: string[]
  try {
    raw = rake.generate(text)
  } catch {
    return []
  }

  const seen = new Set<string>()
  const results: string[] = []

  for (const phrase of raw) {
    const keyword = phrase.toLowerCase().trim()
    if (keyword.length >= 3 && !seen.has(keyword)) {
      seen.add(keyword)
      results.push(keyword)
      if (results.length >= max) break
    }
  }

  return results
}
