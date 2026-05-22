/**
 * Extracts keywords from tweet text using a simple frequency-based tokenizer.
 *
 * Splits on whitespace/punctuation, drops a hardcoded English + crypto-noise
 * stopword list, filters tokens shorter than 3 chars, lowercases, dedupes,
 * and returns the top-N by frequency.  No native deps — safe in all runtimes.
 */

// ~100 common English stopwords + crypto/twitter noise tokens
const STOPWORDS = new Set([
  // articles / conjunctions / prepositions
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
  'has', 'have', 'had', 'not', 'but', 'all', 'they', 'their', 'there', 'will',
  'its', 'can', 'you', 'your', 'our', 'out', 'into', 'more', 'about', 'when',
  'just', 'been', 'than', 'also', 'some', 'such', 'even', 'both', 'each',
  'very', 'over', 'after', 'here', 'what', 'like', 'them', 'then', 'these',
  'those', 'which', 'while', 'would', 'could', 'should', 'other', 'doing',
  'being', 'through', 'between', 'because', 'against', 'during', 'before',
  'above', 'below', 'under', 'since', 'without', 'within', 'along',
  'still', 'back', 'again', 'much', 'well', 'only', 'most', 'many',
  // pronouns
  'who', 'him', 'his', 'her', 'she', 'its', 'ours', 'them', 'theirs',
  'myself', 'itself', 'himself', 'herself', 'yourself',
  // common verbs
  'get', 'got', 'let', 'say', 'said', 'see', 'saw', 'going', 'come',
  'make', 'made', 'know', 'think', 'feel', 'take', 'took', 'give', 'gave',
  'want', 'need', 'look', 'looks', 'looked', 'seem', 'seems', 'try',
  'use', 'used', 'keep', 'hold', 'move', 'move', 'run', 'ran', 'big',
  // twitter / crypto noise
  'gm', 'lol', 'lmao', 'imo', 'imho', 'fwiw', 'tbh', 'ngl', 'omg',
  'btw', 'lfg', 'ngmi', 'wagmi', 'fud', 'fomo', 'dyor', 'nfa',
  'rt', 'via', 'amp', 'http', 'https', 'www',
  // filler / slang
  'cap', 'ser', 'fren', 'based', 'cope', 'mid', 'idk', 'yeah', 'yes',
  'nah', 'bro', 'man', 'wow', 'hey', 'guys', 'one', 'two', 'new',
  'now', 'day', 'time', 'way', 'good', 'real', 'true', 'best',
  'next', 'last', 'long', 'high', 'low',
])

/**
 * Extracts keywords from `text`.
 * Returns up to `opts.max` unique lowercase tokens, sorted by frequency.
 */
export function extractKeywords(text: string, opts?: { max?: number }): string[] {
  if (!text || !text.trim()) return []

  const max = opts?.max ?? 10

  // Strip URLs, mentions, and emoji; split on whitespace and punctuation
  const cleaned = text
    .replace(/https?:\/\/\S+/g, ' ')       // URLs
    .replace(/@\w+/g, ' ')                  // @mentions
    .replace(/[^\w\s$#]/gu, ' ')            // punctuation / emoji (keep $ # for tickers/tags)
    .replace(/\s+/g, ' ')
    .trim()

  const freq: Record<string, number> = {}

  for (const raw of cleaned.split(' ')) {
    // Normalise: lowercase, strip leading/trailing $ # _ digits
    const token = raw.toLowerCase().replace(/^[$#_\d]+|[$#_\d]+$/g, '').trim()

    if (token.length < 3) continue
    if (STOPWORDS.has(token)) continue
    // Skip pure-numeric tokens
    if (/^\d+$/.test(token)) continue

    freq[token] = (freq[token] ?? 0) + 1
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])           // highest frequency first
    .slice(0, max)
    .map(([token]) => token)
}
