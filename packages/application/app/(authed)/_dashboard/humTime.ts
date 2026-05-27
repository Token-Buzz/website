/**
 * formatRelativeTime — pure relative-time formatter for Hum conversation timestamps.
 * Returns a human-readable string relative to `now` (defaults to Date.now()).
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  if (!iso) return ''
  const parsed = new Date(iso).getTime()
  if (isNaN(parsed)) return ''

  const diffMs = now - parsed
  const diffSec = diffMs / 1000
  const diffMin = diffSec / 60
  const diffHour = diffMin / 60
  const diffDay = diffHour / 24

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`
  if (diffHour < 24) return `${Math.floor(diffHour)}h ago`
  if (diffDay < 7) return `${Math.floor(diffDay)}d ago`
  return iso.slice(0, 10)
}
