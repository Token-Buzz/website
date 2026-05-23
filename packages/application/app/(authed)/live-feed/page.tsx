'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Eyebrow, Pill, Avatar,
  fmtCount,
} from '../_dashboard/primitives'
import type { Sentiment } from '../_dashboard/types'

// ── Types ──────────────────────────────────────────────────────────────────

type SentimentFilter = Sentiment | 'all'

interface LiveFeedTweet {
  tweetId: string
  authorName: string
  authorUsername: string
  authorAvatar: string | undefined
  text: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  viewCount: number
  tokenTags: string[]
  sentiment: string | undefined
}

interface LiveFeedResponse {
  tweets: LiveFeedTweet[]
  cursor: string | undefined
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeSince(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function isSentiment(v: string | undefined): v is Sentiment {
  return v === 'bull' || v === 'bear' || v === 'neu'
}

// ── TweetCard ──────────────────────────────────────────────────────────────

function TweetCard({ tweet }: { tweet: LiveFeedTweet }) {
  const sent = isSentiment(tweet.sentiment) ? tweet.sentiment : undefined
  return (
    <div
      style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-hairline)',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Top row: Avatar + author + time */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <Avatar name={tweet.authorName || tweet.authorUsername} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                font: '600 13px/1 var(--font-sans)',
                color: 'var(--fg-1)',
                whiteSpace: 'nowrap',
              }}
            >
              {tweet.authorName || tweet.authorUsername}
            </span>
            <span
              style={{
                font: '500 12px/1 var(--font-sans)',
                color: 'var(--fg-3)',
                whiteSpace: 'nowrap',
              }}
            >
              @{tweet.authorUsername}
            </span>
            <span
              style={{
                font: '500 11px/1 var(--font-mono)',
                color: 'var(--fg-4)',
                whiteSpace: 'nowrap',
              }}
            >
              · {timeSince(tweet.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Tweet body */}
      <div
        style={{
          font: '400 13px/1.6 var(--font-sans)',
          color: 'var(--fg-2)',
          marginBottom: 10,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {tweet.text}
      </div>

      {/* Token tags */}
      {tweet.tokenTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {tweet.tokenTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 11,
                padding: '3px 7px',
                borderRadius: 4,
                background: 'var(--bg-sunken)',
                color: 'var(--fg-1)',
                border: '1px solid var(--border)',
                letterSpacing: '-0.01em',
              }}
            >
              ${tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: engagement + sentiment */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span
          style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ♥ {fmtCount(tweet.likeCount)}
        </span>
        <span
          style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ↺ {fmtCount(tweet.retweetCount)}
        </span>
        <span
          style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ↩ {fmtCount(tweet.replyCount)}
        </span>
        <span
          style={{ font: '500 12px/1 var(--font-mono)', color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ◎ {fmtCount(tweet.viewCount)}
        </span>
        {sent && (
          <div style={{ marginLeft: 'auto' }}>
            <Pill tone={sent}>{sent}</Pill>
          </div>
        )}
      </div>
    </div>
  )
}

// ── State labels ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--fg-3)',
        font: '500 13px var(--font-sans)',
      }}
    >
      Loading…
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--neg)',
        font: '500 13px var(--font-sans)',
      }}
    >
      {message}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '48px 20px',
        textAlign: 'center',
        color: 'var(--fg-3)',
        font: '500 13px var(--font-sans)',
      }}
    >
      No tweets yet — add tokens to your watchlist to populate your feed.
    </div>
  )
}

function LoadingMoreIndicator() {
  return (
    <div
      style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--fg-4)',
        font: '500 12px var(--font-mono)',
      }}
    >
      Loading more…
    </div>
  )
}

// ── Sentiment filter options ───────────────────────────────────────────────

const SENTIMENT_FILTERS: { value: SentimentFilter; label: string }[] = [
  { value: 'all',  label: 'All' },
  { value: 'bull', label: 'Bull' },
  { value: 'bear', label: 'Bear' },
  { value: 'neu',  label: 'Neutral' },
]

// ── Main page ──────────────────────────────────────────────────────────────

export default function LiveFeedPage() {
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [tweets, setTweets] = useState<LiveFeedTweet[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Guard against duplicate concurrent fetches
  const loadingMoreRef = useRef(false)

  // ── Build URL ──────────────────────────────────────────────────────────

  function buildUrl(opts: { cursor?: string; sentiment: SentimentFilter }): string {
    const params = new URLSearchParams()
    params.set('limit', '30')
    if (opts.cursor) params.set('cursor', opts.cursor)
    if (opts.sentiment !== 'all') params.set('sentiment', opts.sentiment)
    return `/api/live-feed?${params.toString()}`
  }

  // ── Initial / filter-reset fetch ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function fetchInitial() {
      setLoading(true)
      setError(null)
      setTweets([])
      setCursor(undefined)
      setHasMore(true)

      try {
        const url = buildUrl({ sentiment: sentimentFilter })
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data: LiveFeedResponse = await res.json()
        if (!cancelled) {
          setTweets(data.tweets ?? [])
          setCursor(data.cursor)
          setHasMore(data.cursor !== undefined)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong.')
          setTweets([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchInitial()

    return () => {
      cancelled = true
    }
  }, [sentimentFilter])

  // ── Load more (infinite scroll) ───────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !cursor) return
    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const url = buildUrl({ cursor, sentiment: sentimentFilter })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data: LiveFeedResponse = await res.json()
      setTweets((prev) => [...prev, ...(data.tweets ?? [])])
      setCursor(data.cursor)
      setHasMore(data.cursor !== undefined)
    } catch {
      // Silently fail for pagination; user can scroll up and back down to retry
    } finally {
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [cursor, hasMore, sentimentFilter])

  // ── IntersectionObserver on sentinel ─────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMoreRef.current) {
          void loadMore()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, hasMore])

  // ── Sentinel handler when filter changes ─────────────────────────────

  function handleSentimentChange(value: SentimentFilter) {
    if (value === sentimentFilter) return
    setSentimentFilter(value)
  }

  return (
    <div
      style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Feed</Eyebrow>
        <h1
          style={{
            font: '600 28px/1.15 var(--font-sans)',
            letterSpacing: '-0.015em',
            color: 'var(--fg-1)',
            margin: 0,
          }}
        >
          Live feed
        </h1>
      </div>

      {/* ── Controls row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Sentiment pill group — mirrors Movers window-pill style */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: 3,
            gap: 2,
          }}
        >
          {SENTIMENT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleSentimentChange(f.value)}
              style={{
                border: 'none',
                padding: '5px 11px',
                borderRadius: 999,
                cursor: 'pointer',
                font: '600 11px var(--font-sans)',
                background: sentimentFilter === f.value ? 'var(--bg-elevated)' : 'transparent',
                color: sentimentFilter === f.value ? 'var(--fg-1)' : 'var(--fg-2)',
                boxShadow: sentimentFilter === f.value ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Tweet count */}
        {!loading && !error && tweets.length > 0 && (
          <span
            style={{
              font: '500 12px var(--font-mono)',
              color: 'var(--fg-3)',
            }}
          >
            {tweets.length} tweets
          </span>
        )}
      </div>

      {/* ── Feed ──────────────────────────────────────────────────────────── */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : tweets.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {tweets.map((tweet) => (
              <TweetCard key={tweet.tweetId} tweet={tweet} />
            ))}
            {loadingMore && <LoadingMoreIndicator />}
          </>
        )}

        {/* Sentinel for IntersectionObserver */}
        {!loading && !error && (
          <div ref={sentinelRef} style={{ height: 1 }} />
        )}
      </Card>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      {!loading && !error && tweets.length > 0 && !hasMore && (
        <div
          style={{
            textAlign: 'center',
            font: '500 11px var(--font-mono)',
            color: 'var(--fg-4)',
            letterSpacing: '0.04em',
          }}
        >
          End of feed · tweets from your watchlist tokens
        </div>
      )}
    </div>
  )
}
