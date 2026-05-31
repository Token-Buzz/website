/**
 * Resolve a safe, same-origin post-auth redirect target from the `redirect_url`
 * query param that Clerk's middleware appends when it gates a protected route
 * (e.g. a deep link from the marketing pricing cards to /account/billing).
 *
 * Only root-relative paths are accepted ("/foo"), never an absolute URL to a
 * different origin or a protocol-relative ("//evil.com") path — this prevents
 * an open redirect. An absolute URL on the current origin is reduced to its
 * path. Returns null when the param is absent or unsafe.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim()
  if (!value) return null

  if (/^https?:\/\//i.test(value)) {
    if (typeof window === 'undefined') return null
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return null
    }
    if (parsed.origin !== window.location.origin) return null
    value = parsed.pathname + parsed.search + parsed.hash
  }

  // Must be a single-slash root-relative path.
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}
