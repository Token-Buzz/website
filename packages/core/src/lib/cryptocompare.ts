// CryptoCompare REST API client
// Used by the CryptoCompare BYOK news provider (M14).
// Auth via `api_key` query parameter.
//
// This file will also host the news-fetch wrapper in M14 Phase 2.

export const CRYPTOCOMPARE_BASE_URL = 'https://min-api.cryptocompare.com'

export class CryptoCompareApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'CryptoCompareApiError'
  }
}

/**
 * Validate a CryptoCompare API key via GET /data/v2/news/.
 * Returns ok=false on 401/403 (invalid key) or when the API returns a 200 with
 * Response="Error" (CryptoCompare often returns HTTP 200 for bad keys).
 * Re-throws on 5xx/network errors so callers can surface a transient failure.
 * last4 = apiKey.slice(-4).
 */
export async function validateKey(apiKey: string): Promise<{ ok: boolean; last4: string }> {
  const last4 = apiKey.slice(-4)

  let response: Response
  try {
    response = await fetch(
      `${CRYPTOCOMPARE_BASE_URL}/data/v2/news/?lang=EN&api_key=${encodeURIComponent(apiKey)}`,
    )
  } catch (networkErr) {
    throw networkErr
  }

  if (response.ok) {
    const json = await response.json()
    // CryptoCompare often returns HTTP 200 even for a bad key, with
    // { "Response": "Error", ... }. A non-Error Response means the key is valid.
    const ok = (json as Record<string, unknown>).Response !== 'Error'
    return { ok, last4 }
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, last4 }
  }

  // 5xx and other errors — re-throw so callers can surface transient failures
  throw new CryptoCompareApiError(
    `CryptoCompare API error: ${response.status} ${response.statusText}`,
    response.status,
  )
}
