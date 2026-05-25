// Pure logic for the stamp CLI — no I/O, no process, no network.
// All functions here are deterministic and unit-testable.

/**
 * Convert a GitHub Project field name to the flattened JSON key used by
 * `gh project item-list --format json`.
 *
 * The CLI lowercases only the FIRST character of the field name and preserves
 * the rest (including spaces and capitalisation).
 *
 * Examples:
 *   "Actual Start"  → "actual Start"
 *   "Started At"    → "started At"
 *   "Cycle Time"    → "cycle Time"
 *   "status"        → "status"
 *   ""              → ""
 */
export function fieldJsonKey(fieldName: string): string {
  if (fieldName.length === 0) return ''
  return fieldName[0]!.toLowerCase() + fieldName.slice(1)
}

/**
 * Given two ISO-8601 timestamps (start and finish), return the cycle time
 * as both whole minutes and a human-readable string.
 *
 * Human format rules:
 *   - Omit zero leading units. Never show "0d", "0h" as a prefix.
 *   - 45 min           → "45m"
 *   - 150 min          → "2h 30m"
 *   - 1500 min (25h)   → "1d 1h"    (0 minutes → omit "m")
 *   - 0 or negative    → "0m"       (finish before start is clamped)
 *
 * Unit values:
 *   1 day = 24 hours, 1 hour = 60 minutes.
 */
export function computeCycleTime(
  startedAt: string,
  completedAt: string,
): { minutes: number; human: string } {
  const startMs = new Date(startedAt).getTime()
  const finishMs = new Date(completedAt).getTime()
  const diffMs = finishMs - startMs
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60_000))

  return { minutes: totalMinutes, human: formatCycleTime(totalMinutes) }
}

/**
 * Format a duration in whole minutes to a human-readable string.
 * Omits zero leading units; always shows at least "0m".
 *
 * Examples:
 *   0    → "0m"
 *   1    → "1m"
 *   45   → "45m"
 *   60   → "1h"
 *   90   → "1h 30m"
 *   150  → "2h 30m"
 *   1440 → "1d"
 *   1500 → "1d 1h"
 *   1530 → "1d 1h 30m"
 */
export function formatCycleTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m'

  const MINUTES_PER_HOUR = 60
  const MINUTES_PER_DAY = 60 * 24

  const days = Math.floor(totalMinutes / MINUTES_PER_DAY)
  const remainAfterDays = totalMinutes % MINUTES_PER_DAY
  const hours = Math.floor(remainAfterDays / MINUTES_PER_HOUR)
  const minutes = remainAfterDays % MINUTES_PER_HOUR

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  // All zero after clamping (shouldn't happen given guard above, but be safe)
  return parts.length > 0 ? parts.join(' ') : '0m'
}
