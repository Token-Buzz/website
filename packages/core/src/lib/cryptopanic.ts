// CryptoPanic REST API client
// Used by the CryptoPanic BYOK news provider (M14).
// Auth via `auth_token` query parameter.
//
// This file will also host the news-fetch wrapper in M14 Phase 2.

export const CRYPTOPANIC_BASE_URL = 'https://cryptopanic.com/api/developer/v2'

export class CryptoPanicApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'CryptoPanicApiError'
  }
}

/**
 * Validate a CryptoPanic API token via GET /posts/.
 * Returns ok=false on 400/401/403 (invalid token) or when the API returns a
 * 200 with an error body (token rejected without an HTTP error status).
 * Re-throws on 5xx/network errors so callers can surface a transient failure.
 * last4 = apiKey.slice(-4).
 */
export async function validateKey(apiKey: string): Promise<{ ok: boolean; last4: string }> {
  const last4 = apiKey.slice(-4)

  let response: Response
  try {
    response = await fetch(
      `${CRYPTOPANIC_BASE_URL}/posts/?auth_token=${encodeURIComponent(apiKey)}&public=true`,
    )
  } catch (networkErr) {
    throw networkErr
  }

  if (response.ok) {
    const json = await response.json()
    // CryptoPanic returns a 200 with a results array on success; an error body
    // (no `results` array) means the token was rejected.
    const ok = Array.isArray((json as Record<string, unknown>).results)
    return { ok, last4 }
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return { ok: false, last4 }
  }

  // 5xx and other errors — re-throw so callers can surface transient failures
  throw new CryptoPanicApiError(
    `CryptoPanic API error: ${response.status} ${response.statusText}`,
    response.status,
  )
}
