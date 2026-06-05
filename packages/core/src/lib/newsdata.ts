// NewsData.io REST API client for the BYOK news provider (M14).
// Auth via `apikey` query parameter.
//
// This file will also host the news-fetch wrapper in Phase 2.

export const NEWSDATA_BASE_URL = 'https://newsdata.io/api/1'

export class NewsDataApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'NewsDataApiError'
  }
}

/**
 * Validate a NewsData.io API key via GET /crypto.
 * Returns ok=true when the response is HTTP 200 with `status: 'success'`.
 * Returns ok=false on 400/401/403/422 (invalid or rejected key).
 * Re-throws on 5xx/network errors so callers can surface a transient failure.
 * last4 = apiKey.slice(-4).
 */
export async function validateKey(apiKey: string): Promise<{ ok: boolean; last4: string }> {
  const last4 = apiKey.slice(-4)

  let response: Response
  try {
    response = await fetch(
      `${NEWSDATA_BASE_URL}/crypto?apikey=${encodeURIComponent(apiKey)}`,
    )
  } catch (networkErr) {
    throw networkErr
  }

  if (response.ok) {
    const json = await response.json()
    const ok = (json as Record<string, unknown>).status === 'success'
    return { ok, last4 }
  }

  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 403 ||
    response.status === 422
  ) {
    return { ok: false, last4 }
  }

  // 5xx and other errors — re-throw so callers can surface transient failures
  throw new NewsDataApiError(
    `NewsData.io API error: ${response.status} ${response.statusText}`,
    response.status,
  )
}
