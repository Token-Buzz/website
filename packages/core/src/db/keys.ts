// ── Tweet keys ─────────────────────────────────────────────────────────────

export const tweetKey = (id: string) => ({
  pk: `TWEET#${id}`,
  sk: `TWEET#${id}`,
})

export const tweetQueryGsi = (query: string, timestamp: string, id: string) => ({
  gsi1pk: `QUERY#${query}`,
  gsi1sk: `${timestamp}#${id}`,
})

export const tweetAuthorGsi = (handle: string, timestamp: string, id: string) => ({
  gsi2pk: `AUTHOR#${handle}`,
  gsi2sk: `${timestamp}#${id}`,
})

export const tweetConvGsi = (conversationId: string, id: string) => ({
  gsi3pk: `CONV#${conversationId}`,
  gsi3sk: `TWEET#${id}`,
})

// ── Aggregate keys ──────────────────────────────────────────────────────────

export const aggregateKey = (type: string, scope: string, bucket: string) => ({
  pk: `AGG#${type}#${scope}`,
  sk: `BUCKET#${bucket}`,
})

export const aggregateTopKGsi = (type: string, score: number, scope: string) => ({
  gsi1pk: `TYPE#${type}`,
  gsi1sk: `${score.toString().padStart(10, '0')}#${scope}`,
})

// ── Token keys ──────────────────────────────────────────────────────────────

export const tokenKey = (symbol: string) => ({
  pk: `TOKEN#${symbol.toUpperCase()}`,
  sk: 'META',
})

export const tokenSpikeGsi = (delta: number, symbol: string) => ({
  gsi1pk: 'SPIKE',
  gsi1sk: `${delta.toString().padStart(10, '0')}#${symbol.toUpperCase()}`,
})

export const tokenTrackedGsi = (mentions: number, symbol: string) => ({
  gsi2pk: 'TRACKED',
  gsi2sk: `${mentions.toString().padStart(10, '0')}#${symbol.toUpperCase()}`,
})

// GSI mapping for the three mover windows:
//   1H  → SpikingByDelta    (gsi1pk/gsi1sk, pk value 'SPIKE')           ← unchanged
//   24H → SpikingByDelta24h (gsi3pk/gsi3sk, pk value 'SPIKE#24H')
//   7D  → SpikingByDelta7d  (gsi4pk/gsi4sk, pk value 'SPIKE#7D')
const SPIKE_WINDOW_CONFIG = {
  '1H': { pkAttr: 'gsi1pk', skAttr: 'gsi1sk', pkValue: 'SPIKE' },
  '24H': { pkAttr: 'gsi3pk', skAttr: 'gsi3sk', pkValue: 'SPIKE#24H' },
  '7D': { pkAttr: 'gsi4pk', skAttr: 'gsi4sk', pkValue: 'SPIKE#7D' },
} as const

/**
 * Returns the GSI key attributes (gsiNpk / gsiNsk) for a given mover window.
 * The sort key format matches tokenSpikeGsi: zero-padded delta + '#' + symbol.
 */
export function tokenSpikeWindowGsi(
  window: '1H' | '24H' | '7D',
  delta: number,
  symbol: string,
): Record<string, string> {
  const { pkAttr, skAttr, pkValue } = SPIKE_WINDOW_CONFIG[window]
  const sym = symbol.toUpperCase()
  return {
    [pkAttr]: pkValue,
    [skAttr]: `${delta.toString().padStart(10, '0')}#${sym}`,
  }
}

/** Maps a mover window to its DynamoDB index name. */
export function spikeIndexForWindow(window: '1H' | '24H' | '7D'): string {
  const INDEX_NAMES: Record<'1H' | '24H' | '7D', string> = {
    '1H': 'SpikingByDelta',
    '24H': 'SpikingByDelta24h',
    '7D': 'SpikingByDelta7d',
  }
  return INDEX_NAMES[window]
}

/** The GSI pk value used for a given mover window. */
export function spikePkForWindow(window: '1H' | '24H' | '7D'): string {
  return SPIKE_WINDOW_CONFIG[window].pkValue
}

/** The GSI pk and sk attribute names for a given mover window. */
export function spikeAttrsForWindow(window: '1H' | '24H' | '7D'): {
  pkAttr: string
  skAttr: string
} {
  const { pkAttr, skAttr } = SPIKE_WINDOW_CONFIG[window]
  return { pkAttr, skAttr }
}

export const followerSnapshotKey = (handle: string, date: string) => ({
  pk: `FOLLOWER#${handle.replace('@', '')}`,
  sk: `SNAP#${date}`,
})

// ── UserData keys ───────────────────────────────────────────────────────────

export const watchlistItemKey = (userId: string, symbol: string) => ({
  pk: `USER#${userId}`,
  sk: `WATCHLIST#${symbol.toUpperCase()}`,
})

export const watchlistGroupKey = (userId: string, groupId: string) => ({
  pk: `USER#${userId}`,
  sk: `GROUP#${groupId}`,
})

export const alertKey = (userId: string, alertId: string) => ({
  pk: `USER#${userId}`,
  sk: `ALERT#${alertId}`,
})

/**
 * GSI keys for the ByokHolders index scoped to alert rules by token symbol.
 *
 * Reuses the existing ByokHolders GSI (gsi1pk/gsi1sk on the UserData table)
 * under a disjoint key space: BYOK rows use gsi1pk=`BYOK#<provider>` while
 * alert rows use gsi1pk=`ALERTTOKEN#<SYMBOL>` — the distinct prefixes mean
 * the two row types never collide in the same GSI partition.
 *
 * This lets `listAlertsForToken` discover all users' alert rules for a given
 * symbol without requiring a new GSI or infra change.
 */
export const alertTokenGsi = (symbol: string, userId: string, alertId: string) => ({
  gsi1pk: `ALERTTOKEN#${symbol.toUpperCase()}`,
  gsi1sk: `USER#${userId}#${alertId}`,
})

export const alertTriggerKey = (userId: string, isoTs: string, triggerId: string) => ({
  pk: `USER#${userId}`,
  sk: `TRIGGER#${isoTs}#${triggerId}`,
})

export const byokKey = (userId: string, provider: string) => ({
  pk: `USER#${userId}`,
  sk: `BYOK#${provider}`,
})

export const dashboardKey = (userId: string, dashboardId: string) => ({
  pk: `USER#${userId}`,
  sk: `DASHBOARD#${dashboardId}`,
})

export const planKey = (userId: string) => ({
  pk: `USER#${userId}`,
  sk: 'PLAN',
})

export const usageKey = (userId: string, yyyymm: string, kind: string) => ({
  pk: `USER#${userId}`,
  sk: `USAGE#${yyyymm}#${kind}`,
})

/**
 * Hum AI conversation key builders.
 *
 * Conversation-metadata rows use the `CONV#` prefix; message rows use the
 * `MSG#` prefix. These two prefixes are entirely DISJOINT — neither is a
 * prefix of the other — so:
 *   begins_with(sk, 'CONV#')           → lists conversation rows only
 *   begins_with(sk, 'MSG#<convId>#')   → lists one conversation's messages only
 *
 * This mirrors the ALERT# / TRIGGER# split in alerts.ts and prevents any
 * begins_with query from accidentally returning the wrong row type.
 */
export const conversationKey = (userId: string, conversationId: string) => ({
  pk: `USER#${userId}`,
  sk: `CONV#${conversationId}`,
})

export const conversationMessageKey = (
  userId: string,
  conversationId: string,
  timestamp: string,
) => ({
  pk: `USER#${userId}`,
  sk: `MSG#${conversationId}#${timestamp}`,
})

// ── Analytics aggregate key builders (13 new types + range helper) ──────────
// Each builder returns the { pk, sk } key for one Aggregates row.
// At-least-once delivery from DynamoDB Streams means counts may slightly
// inflate on duplicate events; this is accepted in v1.

export function hashtagAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#HASHTAG#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function mentionAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#MENTION#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function domainAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#DOMAIN#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function bioDomainAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#BIO_DOMAIN#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function langAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#LANG#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function sourceAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#SOURCE#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function verificationAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#VERIFICATION#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function botAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#BOT#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function heatmapAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#HEATMAP#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function keywordAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#KEYWORD#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function authorInfluenceAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#AUTHOR_INFLUENCE#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

export function engagementAggKey(query: string, hourBucket: string) {
  return {
    pk: `AGG#ENGAGEMENT#${query}`,
    sk: `BUCKET#${hourBucket}#engagement`,
  }
}

export function sentimentByQueryAggKey(query: string, hourBucket: string, value: string) {
  return {
    pk: `AGG#SENTIMENT_BY_QUERY#${query}`,
    sk: `BUCKET#${hourBucket}#${value}`,
  }
}

/**
 * Returns the pk and sk prefix for a range query on a given aggregate type.
 * Used by Phase 4 route handlers to query all buckets in a time window.
 */
export function aggRangeKey(type: string, query: string) {
  return {
    pk: `AGG#${type}#${query}`,
    skPrefix: 'BUCKET#',
  }
}

// ── Time bucket helpers ─────────────────────────────────────────────────────

export function hourBucket(ts: Date | string | number): string {
  const d = new Date(ts)
  return `${d.toISOString().slice(0, 13)}:00:00Z`
}

export function minuteBucket(ts: Date | string | number): string {
  const d = new Date(ts)
  return `${d.toISOString().slice(0, 16)}:00Z`
}

export function dayBucket(ts: Date | string | number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function bucketRange(
  window: '1H' | '4H' | '24H' | '7D',
  unit: 'minute' | 'hour' | 'day',
): string[] {
  const counts = { '1H': 60, '4H': 240, '24H': 24, '7D': 7 }
  const ms = { minute: 60_000, hour: 3_600_000, day: 86_400_000 }
  const fn = unit === 'minute' ? minuteBucket : unit === 'hour' ? hourBucket : dayBucket
  const n = counts[window]
  const now = Date.now()
  return Array.from({ length: n }, (_, i) => fn(now - (n - 1 - i) * ms[unit]))
}
