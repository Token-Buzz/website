import { minuteBucket } from './db/keys'

/**
 * Hour-over-hour buzz delta for a token, expressed as a percentage change in
 * tweet volume. A token with prior volume returns the rounded percent change;
 * a token spiking from zero prior volume returns a sentinel (9999) so it ranks
 * at the top; silence returns 0. Kept free of any DB imports so it can be unit
 * tested without an SST stage.
 */
export function computeBuzzDelta(current: number, prior: number): number {
  if (prior > 0) return Math.round(((current - prior) / prior) * 100)
  return current > 0 ? 9999 : 0
}

export type MoverWindow = '1H' | '24H' | '7D'

// Window lengths in minutes.
const WINDOW_MINUTES: Record<MoverWindow, number> = {
  '1H': 60,
  '24H': 1440,
  '7D': 10080,
}

const MINUTE_MS = 60_000

/**
 * Returns the four minute-bucket strings that define the current window and
 * the immediately-prior equal-length window for a given MoverWindow.
 *
 * For a window of length L minutes:
 *   curTo   = minuteBucket(now)
 *   curFrom = minuteBucket(now - (L-1)*60_000)
 *   priorTo = minuteBucket(now - L*60_000)
 *   priorFrom = minuteBucket(now - (2L-1)*60_000)
 *
 * The two windows are disjoint: curFrom > priorTo by exactly one minute bucket.
 * For L=60 (1H): curFrom = now-59m, priorTo = now-60m — matches the existing
 * spike-materializer math (now - 59*MINUTE … now | now - 119*MINUTE … now-60m).
 */
export function windowMinuteRange(
  window: MoverWindow,
  now: number,
): { curFrom: string; curTo: string; priorFrom: string; priorTo: string } {
  const L = WINDOW_MINUTES[window]
  return {
    curTo: minuteBucket(now),
    curFrom: minuteBucket(now - (L - 1) * MINUTE_MS),
    priorTo: minuteBucket(now - L * MINUTE_MS),
    priorFrom: minuteBucket(now - (2 * L - 1) * MINUTE_MS),
  }
}
