/**
 * Codec for encoding/decoding the composite URL segment used to identify
 * a saved query: `${submittedAt}_${queryHash}`.
 *
 * `submittedAt` is an ISO-8601 timestamp (contains no `_`).
 * `queryHash`   is a 16 hex char string (contains no `_`).
 *
 * The caller is responsible for wrapping the encoded value in
 * `encodeURIComponent` before embedding it in a URL.
 */

const QUERY_HASH_RE = /^[0-9a-f]{16}$/

/**
 * Encode a saved-query identity into a single URL-segment string.
 */
export function encodeQueryId(submittedAt: string, queryHash: string): string {
  return `${submittedAt}_${queryHash}`
}

/**
 * Decode a queryId segment (already URL-decoded by Next.js).
 * Returns `null` if the format is invalid.
 */
export function decodeQueryId(
  queryId: string,
): { submittedAt: string; queryHash: string } | null {
  const lastUnderscore = queryId.lastIndexOf('_')
  if (lastUnderscore === -1) return null

  const submittedAt = queryId.slice(0, lastUnderscore)
  const queryHash = queryId.slice(lastUnderscore + 1)

  if (!submittedAt || !queryHash) return null
  if (!QUERY_HASH_RE.test(queryHash)) return null

  return { submittedAt, queryHash }
}
