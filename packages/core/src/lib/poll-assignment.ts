export interface PollHolder {
  userId: string
  queries: string[]
}

/**
 * Assigns each distinct query to exactly one holder (the FIRST holder, in input
 * order, that tracks it). Queries are compared case-insensitively after trim;
 * the original (trimmed) spelling from the winning holder is kept as the value's query.
 * Returns a map: userId -> the queries assigned to that holder (only holders with >=1 assigned appear).
 */
export function assignQueriesToHolders(holders: PollHolder[]): Map<string, string[]> {
  const claimed = new Set<string>()
  const result = new Map<string, string[]>()

  for (const holder of holders) {
    const assigned: string[] = []

    for (const raw of holder.queries) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      const normalized = trimmed.toLowerCase()
      if (claimed.has(normalized)) continue
      claimed.add(normalized)
      assigned.push(trimmed)
    }

    if (assigned.length > 0) {
      result.set(holder.userId, assigned)
    }
  }

  return result
}
