/**
 * Suggests a default search query for a given ticker symbol.
 *
 * The returned query targets the symbol in both cashtag ($SYM) and hashtag
 * (#SYM) forms, which are the two most common ways tickers appear in social
 * content. The symbol is always uppercased and any leading `$` is stripped
 * before constructing the query.
 *
 * Examples:
 *   "PEPE"  → "$PEPE OR #PEPE"
 *   "$BTC"  → "$BTC OR #BTC"
 *   "eth"   → "$ETH OR #ETH"
 */
export function suggestQueryForTicker(symbol: string): string {
  if (!symbol || symbol.trim().length === 0) {
    throw new Error('symbol must be a non-empty string')
  }

  // Strip leading $ and uppercase.
  const normalized = symbol.trim().replace(/^\$/, '').toUpperCase()

  return `$${normalized} OR #${normalized}`
}
