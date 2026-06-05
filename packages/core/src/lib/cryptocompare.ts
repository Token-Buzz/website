// CryptoCompare REST API client
// Used by the CryptoCompare BYOK news provider (M14).
// Auth via `api_key` query parameter.

import type { NewsArticle } from './news-relevance'

export const CRYPTOCOMPARE_BASE_URL = 'https://min-api.cryptocompare.com'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

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
 * Fetches the latest crypto news from CryptoCompare (`/data/v2/news/` endpoint).
 * Makes a single GET request with bounded retry (mirrors twitter.ts pattern):
 *   - Network errors → retry with backoff; throw on exhaustion.
 *   - 4xx → throw CryptoCompareApiError immediately (no retry).
 *   - 5xx → retry with backoff; throw on exhaustion.
 *   - HTTP 200 with `Response: 'Error'` → throw CryptoCompareApiError(401) (bad key).
 * Returns an empty array when the response has no `Data` array.
 */
export async function fetchNews(apiKey: string): Promise<NewsArticle[]> {
  const url = `${CRYPTOCOMPARE_BASE_URL}/data/v2/news/?lang=EN&api_key=${encodeURIComponent(apiKey)}`

  let response: Response | undefined
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      response = await fetch(url)
    } catch (networkErr) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
        continue
      }
      throw networkErr
    }

    if (response.ok) break

    // 4xx → permanent failure, throw immediately (no retry)
    if (response.status >= 400 && response.status < 500) {
      throw new CryptoCompareApiError(
        `CryptoCompare API error: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    // 5xx → transient; retry if budget remains
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      continue
    }

    throw new CryptoCompareApiError(
      `CryptoCompare API error: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  if (!response!.ok) {
    throw new CryptoCompareApiError(
      `CryptoCompare API error: ${response!.status} ${response!.statusText}`,
      response!.status,
    )
  }

  const json = (await response!.json()) as {
    Response?: string
    Data?: Array<Record<string, unknown>>
  }

  // CryptoCompare returns HTTP 200 with { Response: 'Error' } for bad keys
  if (json.Response === 'Error') {
    throw new CryptoCompareApiError('CryptoCompare API error: invalid API key', 401)
  }

  if (!Array.isArray(json.Data)) {
    return []
  }

  const articles: NewsArticle[] = []
  for (const raw of json.Data) {
    const url_ = (raw['url'] as string | undefined) ?? ''

    // Skip items with no url
    if (!url_) continue

    const guid =
      (raw['guid'] as string | undefined) ||
      (raw['id'] !== undefined ? String(raw['id']) : '') ||
      url_

    const title = ((raw['title'] as string | undefined) ?? '').trim() || '(untitled)'

    // Normalize summary: trim/collapse whitespace, cap to 500 chars
    let summary: string | undefined
    const rawBody = (raw['body'] as string | undefined) ?? ''
    if (rawBody) {
      const trimmed = rawBody.replace(/\s+/g, ' ').trim()
      if (trimmed) {
        summary = trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed
      }
    }

    // published_on is unix seconds; fall back to now if missing/invalid
    let publishedAt: string
    const publishedOn = raw['published_on'] as number | undefined
    if (publishedOn !== undefined) {
      const d = new Date(publishedOn * 1000)
      publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    } else {
      publishedAt = new Date().toISOString()
    }

    const sourceInfo = raw['source_info'] as Record<string, unknown> | undefined
    const sourceName =
      (sourceInfo?.['name'] as string | undefined) ||
      (raw['source'] as string | undefined) ||
      'CryptoCompare'

    articles.push({
      guid,
      link: url_,
      title,
      ...(summary !== undefined && { summary }),
      publishedAt,
      sourceName,
    })
  }

  return articles
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
