/**
 * Pure mapper / derivation functions for the TodayView dashboard.
 * These are free of React and framework dependencies so they can be
 * unit-tested directly.
 */

import { fmtCount } from './primitives'
import type { StreamPost, AlertItem } from './types'

// ── API response shape (mirrors app/api/dashboard/today/route.ts) ──────────

export interface TodayKPIs {
  mentions24h: number
  tokenCount: number
  netSentiment: number
  alertCount: number
}

export interface TodayPulse {
  series: number[]
}

export interface TodaySpike {
  symbol: string
  deltaScore: number
  mentions: number
  sentiment: string
}

export interface TodayAlert {
  time: string
  tag: string
  target: string
  body: string
  tone: 'buzz' | 'sent' | 'handle' | 'narrative'
}

export interface SentimentToken {
  sym: string
  mentions: number
  score: number
  d: number
}

export interface SentimentSplit {
  bull: number
  neu: number
  bear: number
}

export interface TodayApiResponse {
  kpis: TodayKPIs
  pulse: TodayPulse
  spikes: TodaySpike[]
  alerts: TodayAlert[]
  watchlistSymbols: string[]
  sentimentGrid: SentimentToken[]
  sentimentSplit: SentimentSplit
}

export interface LiveFeedTweet {
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

// ── Relative-time helper ──────────────────────────────────────────────────

/**
 * Returns a short relative-time string (e.g. "2m", "4h") from an ISO date
 * string. If the date is invalid, returns "".
 */
export function relativeTime(isoDate: string, now: number = Date.now()): string {
  if (!isoDate) return ''
  const d = new Date(isoDate).getTime()
  if (isNaN(d)) return ''
  const secs = Math.floor((now - d) / 1000)
  if (secs < 0) return 'just now'
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

// ── Pulse derivation ──────────────────────────────────────────────────────

/**
 * Derives the "current" mentions/min number from a pulse series by averaging
 * the last few buckets (most-recent window).
 */
export function derivePulseMpm(series: number[], windowBuckets = 5): number {
  if (!series.length) return 0
  const tail = series.slice(-windowBuckets)
  const avg = tail.reduce((s, v) => s + v, 0) / tail.length
  return Math.round(avg)
}

/**
 * Derives the series average (vs avg baseline).
 */
export function derivePulseAvg(series: number[]): number {
  if (!series.length) return 0
  return Math.round(series.reduce((s, v) => s + v, 0) / series.length)
}

// ── Headline derivation ───────────────────────────────────────────────────

/**
 * Returns a greeting headline derived from real data.
 * Falls back to a clean generic line when no data is available.
 */
export function deriveHeadline(
  spikes: TodaySpike[],
  alertCount: number,
): string {
  if (spikes.length > 0) {
    const top = spikes[0]
    const pct = top.deltaScore > 0 ? `+${top.deltaScore}%` : `${top.deltaScore}%`
    return `$${top.symbol} is up ${pct} on mentions${alertCount > 0 ? ` · ${alertCount} new alert${alertCount === 1 ? '' : 's'} fired today` : ''}.`
  }
  if (alertCount > 0) {
    return `${alertCount} alert${alertCount === 1 ? '' : 's'} fired today.`
  }
  return 'No major spikes yet — markets are quiet.'
}

// ── Stream mapper ─────────────────────────────────────────────────────────

/**
 * Maps live-feed API tweets to the StreamPost shape used by the Stream component.
 */
export function mapTweetsToStream(tweets: LiveFeedTweet[]): StreamPost[] {
  return tweets.map((t) => {
    const raw = t.sentiment?.toLowerCase() ?? ''
    const sent: StreamPost['sent'] =
      raw === 'bull' || raw === 'positive'
        ? 'bull'
        : raw === 'bear' || raw === 'negative'
          ? 'bear'
          : 'neu'
    return {
      handle: `@${t.authorUsername}`,
      followers: '',          // not available in live-feed API in Phase 1
      time: relativeTime(t.createdAt),
      sent,
      text: t.text,
      tick: t.tokenTags[0] ?? '',
    }
  })
}

// ── Alert mapper ──────────────────────────────────────────────────────────

/**
 * Maps TodayAlert (API shape) to AlertItem (component prop shape).
 */
export function mapApiAlertsToItems(alerts: TodayAlert[]): AlertItem[] {
  return alerts.map((a) => ({
    tone: a.tone,
    time: a.time,
    tag: a.tag,
    target: a.target,
    body: a.body,
  }))
}

// ── KPI formatters ────────────────────────────────────────────────────────

/**
 * Formats a raw number (mentions24h) into a human-readable count string.
 * Exported separately so TodayView can format without importing primitives.
 */
export { fmtCount }

// ── Spike mapper ──────────────────────────────────────────────────────────

/**
 * Maps a TodaySpike from the API into the prop shape accepted by SpikeCard.
 * No spark data in Phase 1 — spark array is empty.
 */
export interface SpikeCardData {
  sym: string
  deltaScore: number
  mentions: number
  sentiment: string
}

export function mapApiSpikes(spikes: TodaySpike[]): SpikeCardData[] {
  return spikes.map((s) => ({
    sym: s.symbol,
    deltaScore: s.deltaScore,
    mentions: s.mentions,
    sentiment: s.sentiment,
  }))
}

// ── Sentiment grid helpers ────────────────────────────────────────────────

/**
 * Derives the cell background intensity from a sentiment score.
 * Returns an opacity value 0..1 based on |score| / 80, clamped to 0..1.
 * Used to drive color-mix intensity in SentCell.
 */
export function deriveSentCellIntensity(score: number): number {
  return Math.min(Math.abs(score) / 80, 1)
}

/**
 * Converts raw split counts to display percentages (0..100, integer).
 * If total is 0, returns all zeros.
 */
export function deriveSplitPcts(split: SentimentSplit): { bull: number; neu: number; bear: number } {
  const total = split.bull + split.neu + split.bear
  if (total === 0) return { bull: 0, neu: 0, bear: 0 }
  return {
    bull: Math.round((split.bull / total) * 100),
    neu: Math.round((split.neu / total) * 100),
    bear: Math.round((split.bear / total) * 100),
  }
}
