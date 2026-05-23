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
