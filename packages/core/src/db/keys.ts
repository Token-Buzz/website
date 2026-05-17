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
