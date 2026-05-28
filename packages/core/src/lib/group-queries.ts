/**
 * Pure date-grouping helper for saved queries.
 *
 * Groups items into "Today" / "Yesterday" / "This week" / "Older" based on
 * each item's `submittedAt` ISO string vs. the supplied `now` ISO string.
 * Empty groups are dropped. Items within each group preserve the order of the
 * input array (caller is expected to pre-sort newest-first).
 *
 * The function is generic over any type that has a `submittedAt: string` field.
 * `now` is passed in as a parameter so the function is deterministic in tests.
 */

export interface QueryGroup<T> {
  label: string
  items: T[]
}

type WithSubmittedAt = { submittedAt: string }

export function groupQueriesByDate<T extends WithSubmittedAt>(
  items: T[],
  now: string,
): QueryGroup<T>[] {
  const nowDate = new Date(now)

  // Normalise a Date to midnight UTC for day-level comparisons.
  function startOfDayUTC(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }

  const todayStart = startOfDayUTC(nowDate)
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000)

  const groups: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Older: [],
  }

  for (const item of items) {
    const d = startOfDayUTC(new Date(item.submittedAt))
    if (d >= todayStart) {
      groups['Today'].push(item)
    } else if (d >= yesterdayStart) {
      groups['Yesterday'].push(item)
    } else if (d >= weekStart) {
      groups['This week'].push(item)
    } else {
      groups['Older'].push(item)
    }
  }

  const ORDER = ['Today', 'Yesterday', 'This week', 'Older'] as const
  return ORDER.filter((label) => groups[label].length > 0).map((label) => ({
    label,
    items: groups[label],
  }))
}
