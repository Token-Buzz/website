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

// ── Social event keys ───────────────────────────────────────────────────────

/**
 * Key builder for social event rows on the Aggregates table.
 * pk = `AGG#<type>#<SYMBOL>`, sk = `EVT#<11-digit-ts>[#<id>]`.
 * Using a plain string for `type` (instead of SocialEventType) avoids
 * importing the union here and mirrors the aggregateKey convention.
 */
export function socialEventKey(symbol: string, type: string, ts: number, id?: string) {
  return {
    pk: `AGG#${type}#${symbol.toUpperCase()}`,
    sk: `EVT#${ts.toString().padStart(11, '0')}${id ? `#${id}` : ''}`,
  }
}

// ── OHLCV / price keys ──────────────────────────────────────────────────────

// Rate-limit counter key (stored in Aggregates table with a short TTL)
export const rateLimitKey = (provider: string, minuteStr: string) => ({
  pk: `RATELIMIT#${provider}`,
  sk: `MINUTE#${minuteStr}`,
})

export const ohlcvKey = (symbol: string, interval: string, ts: number) => ({
  pk: `TOKEN#${symbol.toUpperCase()}`,
  sk: `OHLCV#${interval}#${ts.toString().padStart(11, '0')}`,
})

export const tokenRefKey = (symbol: string) => ({
  pk: `TOKEN#${symbol.toUpperCase()}`,
  sk: 'REF',
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

export const watchlistEntryKey = (userId: string, entryId: string) => ({
  pk: `USER#${userId}`,
  sk: `WATCH#${entryId}`,
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

export const savedQueryKey = (userId: string, submittedAt: string, queryHash: string) => ({
  pk: `USER#${userId}`,
  sk: `QUERY#${submittedAt}#${queryHash}`,
})

export const stripeEventKey = (eventId: string) => ({
  pk: `STRIPE_EVENT#${eventId}`,
  sk: 'PROCESSED',
})

export const stripeCustomerKey = (customerId: string) => ({
  pk: `STRIPE_CUSTOMER#${customerId}`,
  sk: 'USER',
})

export const notificationPrefsKey = (userId: string) => ({
  pk: `USER#${userId}`,
  sk: 'NOTIFPREFS',
})

export const ingestionSettingsKey = (userId: string) => ({
  pk: `USER#${userId}`,
  sk: 'SETTINGS#ingestion',
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

// ── Monitor keys (UserData table) ───────────────────────────────────────────

export const monitorKey = (userId: string, query: string) => ({
  pk: `USER#${userId}`,
  sk: `MONITOR#${query}`,
})
export const monitorSkPrefix = 'MONITOR#'

/**
 * Constant partition for the ByokHolders GSI used to enumerate ALL monitors.
 *
 * Reuses the existing ByokHolders GSI (gsi1pk/gsi1sk on the UserData table)
 * under a disjoint key space: BYOK rows use gsi1pk=`BYOK#<provider>`,
 * alert rows use gsi1pk=`ALERTTOKEN#<SYMBOL>`, and monitor rows use
 * gsi1pk=`MONITORS` — the distinct prefixes mean the row types never collide
 * in the same GSI partition.
 */
export const MONITOR_GSI_PK = 'MONITORS'

/** GSI keys so a monitor row is discoverable via listAllMonitors (ByokHolders index). */
export const monitorGsi = (userId: string, query: string) => ({
  gsi1pk: MONITOR_GSI_PK,
  gsi1sk: `USER#${userId}#${query}`,
})

// ── Poll cadence state (Aggregates table, keyed per source+query) ────────────

export const pollStateKey = (source: string, query: string) => ({
  pk: `POLLSTATE#${source}`,
  sk: `QUERY#${query}`,
})

// ── Per-source ingestion count keys (Aggregates table) ──────────────────────

/** Key for a per-source ingestion count row: one row per (query, source) pair. */
export const sourceCountKey = (query: string, source: string) => ({
  pk: `AGG#SRCCOUNT#${query}`,
  sk: `SRC#${source}`,
})

/** Partition key prefix for listing all per-source counts for a query. */
export const sourceCountPk = (query: string) => `AGG#SRCCOUNT#${query}`

// ── M13: News-volume counters (Aggregates table) ────────────────────────────

/** Counter row on the Aggregates table for press/news feed volume per symbol.
 *  pk = AGG#NEWS_VOLUME#<SYM>, sk = <KIND>#<dayBucket>  (dayBucket = YYYY-MM-DD). */
export const newsVolumeKey = (symbol: string, kind: string, dayBucket: string) => ({
  pk: `AGG#NEWS_VOLUME#${symbol.toUpperCase()}`,
  sk: `${kind}#${dayBucket}`,
})

/** Partition key for listing all news-volume counts for a symbol. */
export const newsVolumePk = (symbol: string) => `AGG#NEWS_VOLUME#${symbol.toUpperCase()}`

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

// ── M13: Feeds + token profile keys ─────────────────────────────────────────

/** Token profile row on the Tokens table: pk=TOKEN#<SYM>, sk=PROFILE. */
export const tokenProfileKey = (symbol: string) => ({
  pk: `TOKEN#${symbol.toUpperCase()}`,
  sk: 'PROFILE',
})

/** Base key for a feed entry row on the Feeds table. */
export const feedItemKey = (
  symbol: string,
  kind: string,
  isoTs: string,
  entryId: string,
) => ({
  pk: `FEED#${symbol.toUpperCase()}#${kind}`,
  sk: `${isoTs}#${entryId}`,
})

/** GSI1 key for querying feed entries by token across kinds (FeedByTokenKindTime). */
export const feedTokenGsi = (
  symbol: string,
  kind: string,
  isoTs: string,
  entryId: string,
) => ({
  gsi1pk: `FEED#${symbol.toUpperCase()}`,
  gsi1sk: `${kind}#${isoTs}#${entryId}`,
})

/** GSI2 key for dedup lookups by feed URL hash + guid hash (FeedByGuid). */
export const feedGuidGsi = (feedUrlHash: string, guidHash: string) => ({
  gsi2pk: `FEEDGUID#${feedUrlHash}`,
  gsi2sk: guidHash,
})

/** Base key for a poll cursor row on the Feeds table. */
export const feedSourceKey = (symbol: string, kind: string, feedUrlHash: string) => ({
  pk: `FEEDSRC#${symbol.toUpperCase()}#${kind}`,
  sk: `SRC#${feedUrlHash}`,
})

/**
 * GSI keys for the WatchersBySymbol query family on the ByokHolders index
 * (UserData table, gsi1pk/gsi1sk).
 *
 * Reuses the existing ByokHolders GSI under a disjoint key space:
 *   BYOK#<provider>   — BYOK credential rows
 *   ALERTTOKEN#<SYM>  — alert rule rows
 *   MONITORS          — monitor rows
 *   WATCHSYM#<SYM>    — watchlist-by-symbol rows  ← this partition family
 * The distinct prefixes guarantee no GSI partition collisions.
 * No new GSI on UserData is required.
 */
export const watchlistBySymbolGsi = (symbol: string, userId: string) => ({
  gsi1pk: `WATCHSYM#${symbol.toUpperCase()}`,
  gsi1sk: `USER#${userId}`,
})
