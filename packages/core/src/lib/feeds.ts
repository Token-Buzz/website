// RSS/Atom feed fetching and parsing boundary.
// Uses rss-parser for XML parsing; mirrors the twitter.ts retry pattern.

import { createHash } from 'node:crypto'
import Parser from 'rss-parser'

// Backoff delays between retry attempts (ms). Exported as mutable so tests can
// set [0, 0] to skip waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

export class FeedFetchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'FeedFetchError'
  }
}

/** sha1(url) hex digest — stable identifier for a feed URL. */
export function feedUrlHash(url: string): string {
  return createHash('sha1').update(url).digest('hex')
}

/** sha1(guid || link) hex — prefers guid when present. */
export function entryId(guid: string, link: string): string {
  return createHash('sha1').update(guid || link).digest('hex')
}

export interface ParsedEntry {
  guid: string
  link: string
  title: string
  summary?: string
  publishedAt: string // ISO-8601
}

export interface FetchFeedResult {
  notModified: boolean
  status: number
  etag?: string
  lastModified?: string
  sourceName?: string
  entries: ParsedEntry[]
}

/**
 * Fetches and parses an RSS/Atom feed.
 * Supports conditional GET via If-None-Match (etag) and If-Modified-Since headers.
 * Retries on network errors and 5xx responses; throws FeedFetchError on 4xx.
 */
export async function fetchFeed(
  feedUrl: string,
  opts?: { etag?: string; lastModified?: string },
): Promise<FetchFeedResult> {
  const headers: Record<string, string> = {
    'User-Agent': 'TokenBuzz-FeedPoller/1.0',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  }
  if (opts?.etag) headers['If-None-Match'] = opts.etag
  if (opts?.lastModified) headers['If-Modified-Since'] = opts.lastModified

  let response: Response | undefined
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      response = await fetch(feedUrl, { headers })
    } catch (networkErr) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
        continue
      }
      throw networkErr
    }

    if (response.status === 304) {
      return { notModified: true, status: 304, entries: [] }
    }

    if (response.ok) {
      break
    }

    // 4xx → permanent failure, throw immediately (no retry)
    if (response.status >= 400 && response.status < 500) {
      throw new FeedFetchError(
        `Feed fetch error: ${response.status} ${response.statusText} — ${feedUrl}`,
        response.status,
      )
    }

    // 5xx → transient; retry if budget remains
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      continue
    }

    throw new FeedFetchError(
      `Feed fetch error: ${response.status} ${response.statusText} — ${feedUrl}`,
      response.status,
    )
  }

  if (!response!.ok) {
    throw new FeedFetchError(
      `Feed fetch error: ${response!.status} ${response!.statusText} — ${feedUrl}`,
      response!.status,
    )
  }

  const etag = response!.headers.get('etag') ?? undefined
  const lastModified = response!.headers.get('last-modified') ?? undefined
  const text = await response!.text()

  const parser = new Parser()
  const feed = await parser.parseString(text)

  // Derive sourceName from feed title, fallback to URL hostname
  let sourceName: string | undefined
  if (feed.title) {
    sourceName = feed.title.trim() || undefined
  }
  if (!sourceName) {
    try {
      sourceName = new URL(feedUrl).hostname
    } catch {
      sourceName = feedUrl
    }
  }

  const entries: ParsedEntry[] = []

  for (const item of feed.items ?? []) {
    const guid = item.guid ?? item.id ?? item.link ?? ''
    const link = item.link ?? ''

    // Skip items with neither link nor guid
    if (!guid && !link) continue

    const title = item.title ?? '(untitled)'

    // Build a short plain-text summary
    let summary: string | undefined
    const rawSnippet = item.contentSnippet ?? item.content ?? item.summary ?? ''
    if (rawSnippet) {
      const trimmed = rawSnippet.replace(/\s+/g, ' ').trim()
      summary = trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed
      if (!summary) summary = undefined
    }

    // Parse publishedAt from isoDate or pubDate, fall back to now
    let publishedAt: string
    if (item.isoDate) {
      const d = new Date(item.isoDate)
      publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    } else if (item.pubDate) {
      const d = new Date(item.pubDate)
      publishedAt = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    } else {
      publishedAt = new Date().toISOString()
    }

    entries.push({ guid, link, title, ...(summary !== undefined && { summary }), publishedAt })
  }

  return {
    notModified: false,
    status: response!.status,
    ...(etag !== undefined && { etag }),
    ...(lastModified !== undefined && { lastModified }),
    sourceName,
    entries,
  }
}
