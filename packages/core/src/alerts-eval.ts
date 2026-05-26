/**
 * Pure alert-evaluation logic — no DB imports so this module can be unit-tested
 * without an SST stage or live DynamoDB. Mirror of the movers.ts pattern.
 *
 * The evaluation functions accept an AlertRule and a TokenSnapshot (and
 * optionally a prior snapshot for sentiment comparisons) and return a fully
 * populated AlertEvalResult indicating whether the rule fired, the human-
 * readable message, the numeric value that was measured, and the app link to
 * surface in the in-app notification.
 */

export type AlertCondition = 'mention_spike' | 'sentiment_swing' | 'price_move'
export type Sentiment = 'bull' | 'bear' | 'neu'
export type SentimentTarget = 'bull' | 'bear' | 'any'

export interface AlertRule {
  alertId: string
  userId: string
  symbol: string
  condition: AlertCondition
  /** Percentage threshold for mention_spike and price_move; ignored for sentiment_swing. */
  threshold: number
  /** For sentiment_swing: which target sentiment triggers the rule. Defaults to 'any'. */
  target?: SentimentTarget
  channel: 'in_app'
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastTriggeredAt?: string
}

export interface TokenSnapshot {
  sym: string
  /** 1-hour buzz delta percentage (dbuzz1h). */
  dbuzz1h: number
  /** 24-hour price delta percentage (d24). */
  d24: number
  sent: Sentiment
}

export interface AlertEvalResult {
  triggered: boolean
  message: string
  /** The numeric value that was compared against the threshold. */
  value: number
  /** App route to link to in the notification: '/movers' or '/live-feed'. */
  link: string
}

/** 1-hour cooldown: don't re-fire the same rule within this window. */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000

/**
 * Evaluates an alert rule against the current (and optionally prior) token snapshot.
 * Always returns a fully-populated AlertEvalResult — callers do not need to check
 * for undefined fields even when the rule does not trigger.
 *
 * Conditions:
 * - `mention_spike`: fires when current.dbuzz1h >= rule.threshold.
 * - `price_move`:    fires when |current.d24| >= rule.threshold.
 * - `sentiment_swing`: fires when prior sentiment differs from current sentiment
 *   AND (rule.target === 'any' or current sentiment matches rule.target).
 *   Returns triggered:false when prior is null/undefined (no baseline to compare).
 */
export function evaluateRule(
  rule: AlertRule,
  current: TokenSnapshot,
  prior?: TokenSnapshot | null,
): AlertEvalResult {
  const sym = rule.symbol.toUpperCase()

  if (rule.condition === 'mention_spike') {
    const value = current.dbuzz1h
    const triggered = value >= rule.threshold
    return {
      triggered,
      message: triggered
        ? `${sym} buzz +${value}% (1h)`
        : `${sym} buzz ${value}% (1h) — below threshold`,
      value,
      link: '/movers',
    }
  }

  if (rule.condition === 'price_move') {
    const value = current.d24
    const triggered = Math.abs(value) >= rule.threshold
    const sign = value >= 0 ? '+' : ''
    return {
      triggered,
      message: triggered
        ? `${sym} price ${sign}${value}% (24h)`
        : `${sym} price ${sign}${value}% (24h) — below threshold`,
      value,
      link: '/movers',
    }
  }

  // sentiment_swing
  if (!prior) {
    return {
      triggered: false,
      message: `${sym} sentiment — no prior snapshot to compare`,
      value: 0,
      link: '/live-feed',
    }
  }

  const sentimentChanged = prior.sent !== current.sent
  const targetMatch =
    (rule.target ?? 'any') === 'any' || current.sent === rule.target
  const triggered = sentimentChanged && targetMatch

  return {
    triggered,
    message: triggered
      ? `${sym} sentiment ${prior.sent} → ${current.sent}`
      : `${sym} sentiment ${prior.sent} → ${current.sent} — no match`,
    value: 0,
    link: '/live-feed',
  }
}

/**
 * Returns true if the rule is within its 1-hour cooldown window and should NOT
 * be re-fired. Returns false when lastTriggeredAt is undefined (never fired).
 */
export function isInCooldown(lastTriggeredAt: string | undefined, now: number): boolean {
  if (!lastTriggeredAt) return false
  return now - Date.parse(lastTriggeredAt) < ALERT_COOLDOWN_MS
}
