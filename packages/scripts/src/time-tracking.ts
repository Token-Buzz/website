// Pure logic for the track CLI — no I/O, no process, no fetch.
// All functions here are deterministic and unit-testable.

export interface TogglEntry {
  id: number
  description: string | null
  duration: number
  tags: string[]
  start: string
  stop: string | null
}

/**
 * Parse an issue argument like "83", "#83", or "#83 some title text".
 * Returns the integer issue number. Throws on invalid input.
 */
export function parseIssueArg(arg: string): number {
  const match = arg.trim().match(/^#?(\d+)/)
  if (!match) {
    throw new Error(`Invalid issue argument: "${arg}". Expected a positive integer like "83" or "#83".`)
  }
  const n = parseInt(match[1], 10)
  if (n <= 0) {
    throw new Error(`Invalid issue number: ${n}. Must be a positive integer.`)
  }
  return n
}

/**
 * Build a Toggl entry description from an issue number and title.
 */
export function formatEntryName(issueNumber: number, title: string): string {
  return `#${issueNumber} ${title.trim()}`
}

/**
 * Format a duration in seconds to a human-readable string.
 * Negative durations (running entries) clamp to 0.
 * 0 → "0m"; under an hour → "45m"; hours → "2h 5m" (minutes always shown when hours present).
 */
export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const totalMinutes = Math.floor(clamped / 60)

  if (totalMinutes === 0) return '0m'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/**
 * Summarize Toggl entries into AI / human / other / total second buckets.
 * Bucket precedence: "ai" tag → ai; "human" tag → human; else → other.
 * Entries with negative duration (still running) are skipped.
 */
export function summarizeEntries(entries: TogglEntry[]): {
  ai: number
  human: number
  other: number
  total: number
} {
  let ai = 0
  let human = 0
  let other = 0

  for (const entry of entries) {
    if (entry.duration < 0) continue
    if (entry.tags.includes('ai')) {
      ai += entry.duration
    } else if (entry.tags.includes('human')) {
      human += entry.duration
    } else {
      other += entry.duration
    }
  }

  return { ai, human, other, total: ai + human + other }
}

/**
 * Compute the default date range: since = now - days*24h, until = now.
 */
export function getDefaultRange(now: Date, days = 7): { since: Date; until: Date } {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { since, until: now }
}

/**
 * Filter items to those whose closedAt is non-null and within [since, until] inclusive.
 */
export function filterClosedInRange<T extends { closedAt: string | null }>(
  items: T[],
  since: Date,
  until: Date,
): T[] {
  return items.filter(item => {
    if (!item.closedAt) return false
    const t = new Date(item.closedAt).getTime()
    return t >= since.getTime() && t <= until.getTime()
  })
}

export interface ReportModel {
  since: Date
  until: Date
  totals: { ai: number; human: number; other: number; total: number }
  closedIssues: { number: number; title: string; closedAt: string; milestone: string | null }[]
  closedMilestones: { number: number; title: string; closedAt: string }[]
}

export function buildReport(opts: {
  entries: TogglEntry[]
  closedIssues: { number: number; title: string; closedAt: string | null; milestone: string | null }[]
  closedMilestones: { number: number; title: string; closedAt: string | null }[]
  since: Date
  until: Date
}): ReportModel {
  const { entries, closedIssues, closedMilestones, since, until } = opts

  const totals = summarizeEntries(entries)

  const filteredIssues = filterClosedInRange(closedIssues, since, until).map(i => ({
    number: i.number,
    title: i.title,
    closedAt: i.closedAt as string,
    milestone: i.milestone,
  }))

  const filteredMilestones = filterClosedInRange(closedMilestones, since, until).map(m => ({
    number: m.number,
    title: m.title,
    closedAt: m.closedAt as string,
  }))

  return { since, until, totals, closedIssues: filteredIssues, closedMilestones: filteredMilestones }
}

/**
 * Render a ReportModel as a plain-text terminal report.
 */
export function renderReport(model: ReportModel): string {
  const sinceStr = model.since.toISOString().slice(0, 10)
  const untilStr = model.until.toISOString().slice(0, 10)

  const lines: string[] = [
    `Weekly report: ${sinceStr} → ${untilStr}`,
    '',
    'Time tracked',
    `  AI:    ${formatDuration(model.totals.ai)}`,
    `  Human: ${formatDuration(model.totals.human)}`,
    `  Other: ${formatDuration(model.totals.other)}`,
    `  Total: ${formatDuration(model.totals.total)}`,
    '',
    `Issues closed (${model.closedIssues.length})`,
  ]

  for (const issue of model.closedIssues) {
    const milestoneNote = issue.milestone ? ` (${issue.milestone})` : ''
    lines.push(`  #${issue.number} ${issue.title}${milestoneNote}`)
  }

  lines.push('')
  lines.push(`Milestones closed (${model.closedMilestones.length})`)

  for (const ms of model.closedMilestones) {
    lines.push(`  #${ms.number} ${ms.title}`)
  }

  return lines.join('\n')
}
