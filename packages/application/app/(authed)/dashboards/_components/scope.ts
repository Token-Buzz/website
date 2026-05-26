/**
 * Derives a SummaryProvider query string from a Dashboard's optional
 * ticker and query fields.  Returns the space-joined non-empty parts,
 * or an empty string when neither field is set.
 */
export function dashboardScopeQuery(d: {
  ticker?: string
  query?: string
}): string {
  return [d.ticker, d.query]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ')
}
