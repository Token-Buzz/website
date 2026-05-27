/**
 * Social event types and pure detection logic for chart overlays.
 *
 * Three social event types are supported:
 *   SOCIAL_SPIKE   — minutes where mention volume spikes far above baseline
 *   KOL_POST       — a post from a curated "key opinion leader" handle list
 *   SENTIMENT_SPIKE — significant sentiment swings (bullish/bearish)
 *
 * This file has NO db imports so it can be unit-tested without an SST stage.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocialEventType = 'SOCIAL_SPIKE' | 'KOL_POST' | 'SENTIMENT_SPIKE'
export type SocialEventMarker = 'up' | 'down' | 'dot'

export interface SocialEventTweetSample {
  tweetId: string
  handle: string
  text: string
}

export interface SocialEvent {
  type: SocialEventType
  symbol: string        // normalized, uppercased
  ts: number            // unix SECONDS
  marker: SocialEventMarker
  title: string         // short human-readable label
  magnitude?: number    // sigma (spikes) or net-sentiment delta
  direction?: 'positive' | 'negative'
  tweets?: SocialEventTweetSample[]
}

// ── Curated KOL list ──────────────────────────────────────────────────────────

// Lowercase handles, no leading @.
export const KOL_HANDLES: ReadonlySet<string> = new Set([
  'cobie',
  'gainzy222',
  'inversebrah',
  'ansem',
  'hsaka',
  'cryptokaleo',
  'pentoshi',
  'dingalingts',
  'nobrainerbtc',
  'lightcrypto',
  'papisoriano',
  'ethdan',
])

/**
 * Returns true if the given handle is a curated KOL.
 * Strips a leading '@' and lowercases before checking the set.
 */
export function isKolHandle(handle: string): boolean {
  const normalized = handle.startsWith('@') ? handle.slice(1).toLowerCase() : handle.toLowerCase()
  return KOL_HANDLES.has(normalized)
}

// ── Volume spike detection ────────────────────────────────────────────────────

export interface SpikePoint {
  ts: number    // unix seconds
  value: number
}

export interface DetectedSpike {
  ts: number
  sigma: number
  value: number
}

/**
 * Flags points whose value exceeds mean + sigma*stddev computed over ALL
 * provided points.
 *
 * Options:
 *   sigma      — multiplier (default 3)
 *   minSamples — return [] if fewer points than this (default 12)
 *   minValue   — ignore points below this absolute count so a baseline of
 *                near-zero with one tweet doesn't trigger (default 1)
 *
 * Returns results ascending by ts.
 */
export function detectVolumeSpikes(
  points: SpikePoint[],
  opts?: { sigma?: number; minSamples?: number; minValue?: number },
): DetectedSpike[] {
  const { sigma = 3, minSamples = 12, minValue = 1 } = opts ?? {}

  if (points.length < minSamples) return []

  const values = points.map((p) => p.value)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  const stddev = Math.sqrt(variance)

  const threshold = mean + sigma * stddev

  return points
    .filter((p) => p.value >= minValue && p.value > threshold)
    .map((p) => ({
      ts: p.ts,
      sigma: stddev > 0 ? (p.value - mean) / stddev : 0,
      value: p.value,
    }))
    .sort((a, b) => a.ts - b.ts)
}

// ── Sentiment spike detection ─────────────────────────────────────────────────

export interface SentimentPoint {
  ts: number    // unix seconds
  bull: number
  bear: number
  neu: number
}

export interface DetectedSentimentSpike {
  ts: number
  direction: 'positive' | 'negative'
  net: number       // normalised net sentiment in [-1, 1]
  magnitude: number // round(|net - mean|, 2)
}

/**
 * Detects significant sentiment swings.
 *
 * net = (bull - bear) / max(1, bull+bear+neu), in [-1, 1].
 * Compares each point's net to the MEAN net of all points; flags where
 * |net - mean| >= threshold AND total tweets at that point >= minTweets.
 * direction = sign of (net - mean). magnitude = round(|net - mean|, 2).
 *
 * Options:
 *   threshold  — minimum |net - mean| to flag (default 0.4)
 *   minTweets  — minimum tweet volume at a point (default 5)
 *   minSamples — return [] if fewer points than this (default 3)
 *
 * Returns results ascending by ts.
 */
export function detectSentimentSpikes(
  points: SentimentPoint[],
  opts?: { threshold?: number; minTweets?: number; minSamples?: number },
): DetectedSentimentSpike[] {
  const { threshold = 0.4, minTweets = 5, minSamples = 3 } = opts ?? {}

  if (points.length < minSamples) return []

  const nets = points.map((p) => {
    const total = p.bull + p.bear + p.neu
    return (p.bull - p.bear) / Math.max(1, total)
  })
  const meanNet = nets.reduce((s, n) => s + n, 0) / nets.length

  const results: DetectedSentimentSpike[] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const net = nets[i]
    const totalTweets = p.bull + p.bear + p.neu
    const delta = net - meanNet
    if (totalTweets >= minTweets && Math.abs(delta) >= threshold) {
      results.push({
        ts: p.ts,
        direction: delta > 0 ? 'positive' : 'negative',
        net: Math.round(net * 100) / 100,
        magnitude: Math.round(Math.abs(delta) * 100) / 100,
      })
    }
  }

  return results.sort((a, b) => a.ts - b.ts)
}

// ── Pure event builders ───────────────────────────────────────────────────────

/**
 * Builds a SocialEvent from a detected volume spike.
 * marker='up', direction='positive', magnitude=round(sigma,1).
 */
export function volumeSpikeEvent(symbol: string, s: DetectedSpike): SocialEvent {
  return {
    type: 'SOCIAL_SPIKE',
    symbol: symbol.toUpperCase(),
    ts: s.ts,
    marker: 'up',
    title: `Mention spike · ${s.value}/min`,
    magnitude: Math.round(s.sigma * 10) / 10,
    direction: 'positive',
  }
}

/**
 * Builds a SocialEvent from a detected sentiment spike.
 * marker='up' if positive else 'down'.
 */
export function sentimentSpikeEvent(symbol: string, s: DetectedSentimentSpike): SocialEvent {
  return {
    type: 'SENTIMENT_SPIKE',
    symbol: symbol.toUpperCase(),
    ts: s.ts,
    marker: s.direction === 'positive' ? 'up' : 'down',
    title: s.direction === 'positive' ? 'Bullish sentiment swing' : 'Bearish sentiment swing',
    magnitude: s.magnitude,
    direction: s.direction,
  }
}

/**
 * Builds a SocialEvent from a KOL tweet.
 * marker='dot', title=`@${tweet.handle}`.
 */
export function kolPostEvent(symbol: string, ts: number, tweet: SocialEventTweetSample): SocialEvent {
  return {
    type: 'KOL_POST',
    symbol: symbol.toUpperCase(),
    ts,
    marker: 'dot',
    title: `@${tweet.handle}`,
    tweets: [tweet],
  }
}
