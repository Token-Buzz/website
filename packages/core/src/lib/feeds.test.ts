import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { feedUrlHash, entryId, fetchFeed, FeedFetchError } from './feeds'

// ── feedUrlHash ───────────────────────────────────────────────────────────────

describe('feedUrlHash', () => {
  test('returns a 40-char hex string', () => {
    const h = feedUrlHash('https://blog.ethereum.org/feed.xml')
    expect(h).toMatch(/^[0-9a-f]{40}$/)
  })

  test('is deterministic for the same URL', () => {
    const url = 'https://blog.uniswap.org/rss.xml'
    expect(feedUrlHash(url)).toBe(feedUrlHash(url))
  })

  test('differs for different URLs', () => {
    expect(feedUrlHash('https://a.example.com/feed')).not.toBe(
      feedUrlHash('https://b.example.com/feed'),
    )
  })
})

// ── entryId ───────────────────────────────────────────────────────────────────

describe('entryId', () => {
  test('returns a 40-char hex string', () => {
    expect(entryId('some-guid', 'https://example.com/article')).toMatch(/^[0-9a-f]{40}$/)
  })

  test('is deterministic', () => {
    const id = entryId('g-123', 'https://example.com/p/1')
    expect(entryId('g-123', 'https://example.com/p/1')).toBe(id)
  })

  test('prefers guid over link when guid is non-empty', () => {
    const withGuid = entryId('my-guid', 'https://example.com/link')
    const guidOnly = entryId('my-guid', '')
    // Both should resolve to sha1('my-guid')
    expect(withGuid).toBe(guidOnly)
  })

  test('falls back to link when guid is empty', () => {
    const withLink = entryId('', 'https://example.com/link')
    const linkOnly = entryId('', 'https://example.com/link')
    expect(withLink).toBe(linkOnly)
    // Must differ from a call with the same link as guid
    const withGuid = entryId('https://example.com/link', '')
    expect(withLink).toBe(withGuid) // sha1('https://example.com/link') in both cases
  })

  test('produces different ids for different guid values', () => {
    expect(entryId('guid-a', 'https://example.com')).not.toBe(
      entryId('guid-b', 'https://example.com'),
    )
  })
})

// ── fetchFeed ─────────────────────────────────────────────────────────────────

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Ethereum Blog</title>
    <link>https://blog.ethereum.org</link>
    <description>Ethereum Foundation Blog</description>
    <item>
      <title>Pectra Upgrade</title>
      <link>https://blog.ethereum.org/2025/01/pectra</link>
      <guid>https://blog.ethereum.org/2025/01/pectra</guid>
      <pubDate>Wed, 01 Jan 2025 12:00:00 GMT</pubDate>
      <description>Details about the Pectra network upgrade.</description>
    </item>
    <item>
      <title>Another Post</title>
      <link>https://blog.ethereum.org/2025/02/another</link>
      <guid>guid-another-post</guid>
      <pubDate>Fri, 07 Feb 2025 08:00:00 GMT</pubDate>
      <description>A second test entry with plenty of content to summarize.</description>
    </item>
  </channel>
</rss>`

const SAMPLE_RSS_NO_GUID = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Feed Without Guids</title>
    <item>
      <title>Has Link Only</title>
      <link>https://example.com/has-link</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>No Link No Guid</title>
      <pubDate>Mon, 01 Jan 2024 01:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

function makeOkResponse(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml', ...headers },
  })
}

describe('fetchFeed', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('parses a valid RSS feed and returns entries', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(SAMPLE_RSS))

    const result = await fetchFeed('https://blog.ethereum.org/feed.xml')

    expect(result.notModified).toBe(false)
    expect(result.status).toBe(200)
    expect(result.sourceName).toBe('Ethereum Blog')
    expect(result.entries).toHaveLength(2)

    const [first] = result.entries
    expect(first.title).toBe('Pectra Upgrade')
    expect(first.link).toBe('https://blog.ethereum.org/2025/01/pectra')
    expect(first.guid).toBe('https://blog.ethereum.org/2025/01/pectra')
  })

  test('captures etag and last-modified response headers', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      makeOkResponse(SAMPLE_RSS, {
        etag: '"abc123"',
        'last-modified': 'Wed, 01 Jan 2025 12:00:00 GMT',
      }),
    )

    const result = await fetchFeed('https://blog.ethereum.org/feed.xml')

    expect(result.etag).toBe('"abc123"')
    expect(result.lastModified).toBe('Wed, 01 Jan 2025 12:00:00 GMT')
  })

  test('sends If-None-Match when etag is provided', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(SAMPLE_RSS))

    await fetchFeed('https://blog.ethereum.org/feed.xml', { etag: '"old-etag"' })

    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ 'If-None-Match': '"old-etag"' })
  })

  test('sends If-Modified-Since when lastModified is provided', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(SAMPLE_RSS))

    await fetchFeed('https://blog.ethereum.org/feed.xml', {
      lastModified: 'Tue, 01 Jan 2025 00:00:00 GMT',
    })

    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({
      'If-Modified-Since': 'Tue, 01 Jan 2025 00:00:00 GMT',
    })
  })

  test('returns notModified=true and empty entries on 304', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 304 }))

    const result = await fetchFeed('https://blog.ethereum.org/feed.xml', {
      etag: '"cached-etag"',
    })

    expect(result.notModified).toBe(true)
    expect(result.status).toBe(304)
    expect(result.entries).toEqual([])
  })

  test('304 path — If-None-Match header was sent in the request', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 304 }))

    await fetchFeed('https://blog.ethereum.org/feed.xml', { etag: '"my-etag"' })

    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ 'If-None-Match': '"my-etag"' })
  })

  test('pubDate is normalized to ISO string', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(SAMPLE_RSS))

    const result = await fetchFeed('https://blog.ethereum.org/feed.xml')

    // pubDate "Wed, 01 Jan 2025 12:00:00 GMT" → ISO
    expect(result.entries[0].publishedAt).toMatch(/^2025-01-01T/)
  })

  test('falls back to now when pubDate is missing or unparseable', async () => {
    const rssNoPubDate = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>T</title>
<item><title>X</title><link>https://x.example.com/1</link><guid>g1</guid></item>
</channel></rss>`

    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(rssNoPubDate))

    const before = Date.now()
    const result = await fetchFeed('https://x.example.com/feed')
    const after = Date.now()

    const ts = new Date(result.entries[0].publishedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  test('items missing both link and guid are skipped', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(SAMPLE_RSS_NO_GUID))

    const result = await fetchFeed('https://example.com/feed')

    // 'Has Link Only' has link → included; 'No Link No Guid' has neither → skipped
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].title).toBe('Has Link Only')
  })

  test('throws FeedFetchError on 4xx', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    )

    await expect(fetchFeed('https://example.com/gone')).rejects.toBeInstanceOf(FeedFetchError)
  })

  test('FeedFetchError carries the HTTP status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
    )

    let err: FeedFetchError | undefined
    try {
      await fetchFeed('https://example.com/private')
    } catch (e) {
      err = e as FeedFetchError
    }

    expect(err).toBeInstanceOf(FeedFetchError)
    expect(err!.status).toBe(403)
  })

  test('sourceName falls back to hostname when feed has no title', async () => {
    const rssNoTitle = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item><title>P</title><link>https://notitle.example.com/1</link><guid>g1</guid>
<pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
</channel></rss>`

    vi.mocked(global.fetch).mockResolvedValueOnce(makeOkResponse(rssNoTitle))

    const result = await fetchFeed('https://notitle.example.com/feed')

    expect(result.sourceName).toBe('notitle.example.com')
  })
})

// ── fetchFeed retry logic ─────────────────────────────────────────────────────

describe('fetchFeed retry logic', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('5xx then 200 → retries and returns results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Server Error', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(makeOkResponse(SAMPLE_RSS))

    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('./feeds')
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0)

    const result = await mod.fetchFeed('https://blog.ethereum.org/feed.xml')
    expect(result.entries).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('persistent 5xx → throws FeedFetchError after retry budget', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('Error', { status: 503, statusText: 'Service Unavailable' }))

    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('./feeds')
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0)

    await expect(mod.fetchFeed('https://blog.ethereum.org/feed.xml')).rejects.toBeInstanceOf(
      mod.FeedFetchError,
    )
    // 1 initial + 2 retries = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('4xx → throws immediately without retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('Not Found', { status: 404, statusText: 'Not Found' }))

    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('./feeds')
    mod.RETRY_DELAYS_MS.splice(0, mod.RETRY_DELAYS_MS.length, 0, 0)

    await expect(mod.fetchFeed('https://blog.ethereum.org/feed.xml')).rejects.toBeInstanceOf(
      mod.FeedFetchError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
