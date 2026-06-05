// NewsData.io REST API client for the BYOK news provider (M14).
// Auth via `apikey` query parameter.

import type { NewsArticle } from './news-relevance'

export const NEWSDATA_BASE_URL = 'https://newsdata.io/api/1'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

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
 * Fetches the crypto news firehose from NewsData.io (`/crypto` endpoint).
 * Makes a single GET request with bounded retry (mirrors twitter.ts pattern):
 *   - Network errors → retry with backoff; throw on exhaustion.
 *   - 4xx → throw NewsDataApiError immediately (no retry).
 *   - 5xx → retry with backoff; throw on exhaustion.
 * Returns an empty array when the response body has no `results` array or when
 * `status !== 'success'`.
 */
export async function fetchNews(apiKey: string): Promise<NewsArticle[]> {
  const url = `${NEWSDATA_BASE_URL}/crypto?apikey=${encodeURIComponent(apiKey)}`

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
      throw new NewsDataApiError(
        `NewsData.io API error: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    // 5xx → transient; retry if budget remains
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      continue
    }

    throw new NewsDataApiError(
      `NewsData.io API error: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  if (!response!.ok) {
    throw new NewsDataApiError(
      `NewsData.io API error: ${response!.status} ${response!.statusText}`,
      response!.status,
    )
  }

  const json = (await response!.json()) as {
    status?: string
    results?: Array<Record<string, unknown>>
  }

  if (json.status !== 'success' || !Array.isArray(json.results)) {
    return []
  }

  const articles: NewsArticle[] = []
  for (const raw of json.results) {
    const articleId = (raw['article_id'] as string | undefined) ?? ''
    const link = (raw['link'] as string | undefined) ?? ''

    // Skip entries with neither link nor article_id
    if (!articleId && !link) continue

    const guid = articleId || link

    const title = ((raw['title'] as string | undefined) ?? '').trim() || '(untitled)'

    // Normalize summary: trim/collapse whitespace, cap to 500 chars
    let summary: string | undefined
    const rawDesc = (raw['description'] as string | undefined) ?? ''
    if (rawDesc) {
      const trimmed = rawDesc.replace(/\s+/g, ' ').trim()
      if (trimmed) {
        summary = trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed
      }
    }

    // Parse publishedAt; fall back to now if missing or invalid
    let publishedAt: string
    const pubDate = raw['pubDate'] as string | undefined
    if (pubDate) {
      const d = new Date(pubDate)
      publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    } else {
      publishedAt = new Date().toISOString()
    }

    const sourceName =
      (raw['source_name'] as string | undefined) ||
      (raw['source_id'] as string | undefined) ||
      'NewsData.io'

    articles.push({
      guid,
      link,
      title,
      ...(summary !== undefined && { summary }),
      publishedAt,
      sourceName,
    })
  }

  return articles
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
