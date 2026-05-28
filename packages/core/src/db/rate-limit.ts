import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { rateLimitKey } from './keys'

export const GECKOTERMINAL_LIMIT = 25 // threshold out of 30/min free tier
export const JUPITER_LIMIT = 60 // Jupiter is more permissive

// CloudWatch Embedded Metric Format constants — these strings are the contract
// with the infra alarm in infra/monitoring.ts and MUST stay in sync.
export const RATE_LIMIT_METRIC_NAMESPACE = 'TokenBuzz/RateLimit'
export const RATE_LIMIT_METRIC_NAME = 'ProviderCallsPerMin'
export const RATE_LIMIT_METRIC_DIMENSION = 'Provider'
export const WARN_RATIO = 0.8

export interface RateLimitResult {
  allowed: boolean
  count: number
  retryAfterSec: number
}

// Returns seconds until the next minute boundary.
export function retryAfterSeconds(nowMs: number = Date.now()): number {
  return 60 - Math.floor((nowMs / 1000) % 60)
}

/** Returns the call count at which we should emit a near-cap warning metric. */
export function warnThreshold(limit: number): number {
  return Math.floor(limit * WARN_RATIO)
}

/** True when the current count has reached or passed the 80% warning threshold. */
export function nearLimit(count: number, limit: number): boolean {
  return count >= warnThreshold(limit)
}

/**
 * Builds a CloudWatch Embedded Metric Format (EMF) object for the given
 * provider call count. CloudWatch Logs auto-extracts EMF lines into metrics —
 * logging this JSON is sufficient; no PutMetricData call or extra IAM needed.
 */
export function buildRateLimitEmf(
  provider: string,
  count: number,
  nowMs: number = Date.now(),
): Record<string, unknown> {
  return {
    _aws: {
      Timestamp: nowMs,
      CloudWatchMetrics: [
        {
          Namespace: RATE_LIMIT_METRIC_NAMESPACE,
          Dimensions: [[RATE_LIMIT_METRIC_DIMENSION]],
          Metrics: [{ Name: RATE_LIMIT_METRIC_NAME, Unit: 'Count' }],
        },
      ],
    },
    [RATE_LIMIT_METRIC_DIMENSION]: provider,
    [RATE_LIMIT_METRIC_NAME]: count,
  }
}

/**
 * Emits a CloudWatch EMF metric by logging it to stdout.
 * CloudWatch Logs picks up the structured JSON and publishes the metric
 * under TokenBuzz/RateLimit with dimension Provider=<provider>.
 */
export function emitRateLimitMetric(
  provider: string,
  count: number,
  nowMs: number = Date.now(),
): void {
  console.log(JSON.stringify(buildRateLimitEmf(provider, count, nowMs)))
}

// Atomically increments the per-minute call counter for the given provider.
// Returns { allowed, count, retryAfterSec }.
// Stores the counter in the Aggregates table with a 90-second TTL.
export async function checkAndIncrement(
  provider: string,
  limitPerMin: number,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const nowSec = Math.floor(nowMs / 1000)
  // Minute-bucket string: "YYYY-MM-DDTHH:MM" (first 16 chars of ISO string)
  const minuteStr = new Date(nowMs).toISOString().slice(0, 16)
  const key = rateLimitKey(provider, minuteStr)
  const ttl = nowSec + 90 // auto-expire after 90s

  const res = await ddb.send(
    new UpdateCommand({
      TableName: TableNames.aggregates,
      Key: key,
      UpdateExpression: 'ADD #count :inc SET #ttl = :ttl',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':inc': 1, ':ttl': ttl },
      ReturnValues: 'UPDATED_NEW',
    }),
  )

  const count = (res.Attributes?.count as number | undefined) ?? 1
  const allowed = count <= limitPerMin

  // Near-cap tripwire: emit an EMF metric when approaching the per-minute limit.
  // The CloudWatch alarm in infra/monitoring.ts trips on this metric, giving
  // visibility before the hard cap is reached and calls start being rejected.
  if (nearLimit(count, limitPerMin)) {
    emitRateLimitMetric(provider, count, nowMs)
  }

  return { allowed, count, retryAfterSec: retryAfterSeconds(nowMs) }
}
