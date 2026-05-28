/**
 * Pure helper for deduplicating a newest-first list of saved queries.
 *
 * Produces a list of up to `limit` items with distinct `query` strings,
 * preserving newest-first order and keeping the most-recent occurrence of
 * each distinct query. A user re-running the same query many times should
 * not flood the recent-queries dropdown with duplicates.
 *
 * The function is generic over any type that has a `query: string` field.
 * `limit` is passed in as a parameter so callers can control the cap; it
 * defaults to 10 (the standard "recent queries" dropdown size).
 */

type WithQuery = { query: string }

/**
 * From a newest-first list of saved-query items, return up to `limit` items
 * with distinct `query` strings, preserving newest-first order and keeping the
 * most-recent occurrence of each distinct query. (A user re-running the same
 * query many times shouldn't flood the recent-queries dropdown.)
 */
export function recentDistinctQueries<T extends WithQuery>(items: T[], limit = 10): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.query)) continue
    seen.add(item.query)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}
