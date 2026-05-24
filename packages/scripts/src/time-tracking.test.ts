import { describe, it, expect } from 'vitest'
import {
  parseIssueArg,
  formatEntryName,
  formatDuration,
  summarizeEntries,
  getDefaultRange,
  filterClosedInRange,
  buildReport,
  renderReport,
  serializeTrackState,
  parseTrackState,
  type TogglEntry,
  type ReportModel,
  type TrackState,
} from './time-tracking.js'

// ---------------------------------------------------------------------------
// parseIssueArg
// ---------------------------------------------------------------------------
describe('parseIssueArg', () => {
  it('parses a plain integer', () => {
    expect(parseIssueArg('83')).toBe(83)
  })

  it('parses a #-prefixed number', () => {
    expect(parseIssueArg('#83')).toBe(83)
  })

  it('parses a #-prefixed number with trailing text', () => {
    expect(parseIssueArg('#83 fix the thing')).toBe(83)
  })

  it('parses a plain number with trailing text', () => {
    expect(parseIssueArg('42 some title')).toBe(42)
  })

  it('throws on empty string', () => {
    expect(() => parseIssueArg('')).toThrow()
  })

  it('throws on non-numeric junk', () => {
    expect(() => parseIssueArg('abc')).toThrow()
  })

  it('throws on just a hash', () => {
    expect(() => parseIssueArg('#')).toThrow()
  })

  it('throws on negative number', () => {
    // "-83" does not start with an optional # followed by digits
    expect(() => parseIssueArg('-83')).toThrow()
  })

  it('throws on zero', () => {
    expect(() => parseIssueArg('0')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// formatEntryName
// ---------------------------------------------------------------------------
describe('formatEntryName', () => {
  it('formats issue number and title', () => {
    expect(formatEntryName(83, 'Fix the bug')).toBe('#83 Fix the bug')
  })

  it('trims whitespace from title', () => {
    expect(formatEntryName(1, '  padded title  ')).toBe('#1 padded title')
  })

  it('handles empty title', () => {
    expect(formatEntryName(5, '')).toBe('#5 ')
  })
})

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe('formatDuration', () => {
  it('returns "0m" for zero seconds', () => {
    expect(formatDuration(0)).toBe('0m')
  })

  it('returns "0m" for negative seconds (running entry)', () => {
    expect(formatDuration(-3600)).toBe('0m')
  })

  it('returns minutes only when under an hour', () => {
    expect(formatDuration(45 * 60)).toBe('45m')
  })

  it('returns "1m" for 60-119 seconds', () => {
    expect(formatDuration(90)).toBe('1m')
  })

  it('returns "59m" for just under an hour', () => {
    expect(formatDuration(59 * 60 + 59)).toBe('59m')
  })

  it('returns "Xh 0m" for exact hours', () => {
    expect(formatDuration(2 * 3600)).toBe('2h 0m')
  })

  it('returns "Xh Ym" for hours and minutes', () => {
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2h 5m')
  })

  it('rounds seconds down to whole minutes', () => {
    expect(formatDuration(3661)).toBe('1h 1m') // 3661s = 1h 1m 1s → 1h 1m
  })
})

// ---------------------------------------------------------------------------
// summarizeEntries
// ---------------------------------------------------------------------------
describe('summarizeEntries', () => {
  function entry(overrides: Partial<TogglEntry>): TogglEntry {
    return {
      id: 1,
      description: 'test',
      duration: 3600,
      tags: [],
      start: '2025-05-01T10:00:00Z',
      stop: '2025-05-01T11:00:00Z',
      ...overrides,
    }
  }

  it('buckets "ai"-tagged entries into ai', () => {
    const result = summarizeEntries([entry({ tags: ['ai'], duration: 1000 })])
    expect(result).toEqual({ ai: 1000, human: 0, other: 0, total: 1000 })
  })

  it('buckets "human"-tagged entries into human', () => {
    const result = summarizeEntries([entry({ tags: ['human'], duration: 2000 })])
    expect(result).toEqual({ ai: 0, human: 2000, other: 0, total: 2000 })
  })

  it('buckets untagged entries into other', () => {
    const result = summarizeEntries([entry({ tags: [], duration: 500 })])
    expect(result).toEqual({ ai: 0, human: 0, other: 500, total: 500 })
  })

  it('gives ai precedence when both ai and human tags are present', () => {
    const result = summarizeEntries([entry({ tags: ['ai', 'human'], duration: 300 })])
    expect(result).toEqual({ ai: 300, human: 0, other: 0, total: 300 })
  })

  it('skips entries with negative duration (still running)', () => {
    const result = summarizeEntries([entry({ tags: ['ai'], duration: -1 })])
    expect(result).toEqual({ ai: 0, human: 0, other: 0, total: 0 })
  })

  it('sums multiple entries across buckets', () => {
    const result = summarizeEntries([
      entry({ tags: ['ai'], duration: 1000 }),
      entry({ tags: ['human'], duration: 2000 }),
      entry({ tags: [], duration: 500 }),
      entry({ tags: ['ai'], duration: -1 }), // skipped
    ])
    expect(result).toEqual({ ai: 1000, human: 2000, other: 500, total: 3500 })
  })

  it('returns all zeros for empty array', () => {
    expect(summarizeEntries([])).toEqual({ ai: 0, human: 0, other: 0, total: 0 })
  })
})

// ---------------------------------------------------------------------------
// getDefaultRange
// ---------------------------------------------------------------------------
describe('getDefaultRange', () => {
  const now = new Date('2025-05-24T12:00:00Z')

  it('until equals now', () => {
    const { until } = getDefaultRange(now)
    expect(until).toBe(now)
  })

  it('since is exactly 7 days before now by default', () => {
    const { since } = getDefaultRange(now)
    const expectedSince = new Date('2025-05-17T12:00:00Z')
    expect(since.getTime()).toBe(expectedSince.getTime())
  })

  it('respects a custom days parameter', () => {
    const { since } = getDefaultRange(now, 14)
    const expectedSince = new Date('2025-05-10T12:00:00Z')
    expect(since.getTime()).toBe(expectedSince.getTime())
  })
})

// ---------------------------------------------------------------------------
// filterClosedInRange
// ---------------------------------------------------------------------------
describe('filterClosedInRange', () => {
  const since = new Date('2025-05-01T00:00:00Z')
  const until = new Date('2025-05-31T23:59:59Z')

  it('includes items closed within the range', () => {
    const items = [{ closedAt: '2025-05-15T12:00:00Z', id: 1 }]
    expect(filterClosedInRange(items, since, until)).toHaveLength(1)
  })

  it('excludes items with null closedAt', () => {
    const items = [{ closedAt: null, id: 2 }]
    expect(filterClosedInRange(items, since, until)).toHaveLength(0)
  })

  it('excludes items closed before since', () => {
    const items = [{ closedAt: '2025-04-30T23:59:59Z', id: 3 }]
    expect(filterClosedInRange(items, since, until)).toHaveLength(0)
  })

  it('excludes items closed after until', () => {
    const items = [{ closedAt: '2025-06-01T00:00:00Z', id: 4 }]
    expect(filterClosedInRange(items, since, until)).toHaveLength(0)
  })

  it('includes items closed exactly at since boundary', () => {
    const items = [{ closedAt: '2025-05-01T00:00:00Z', id: 5 }]
    expect(filterClosedInRange(items, since, until)).toHaveLength(1)
  })

  it('includes items closed exactly at until boundary', () => {
    const items = [{ closedAt: '2025-05-31T23:59:59Z', id: 6 }]
    expect(filterClosedInRange(items, since, until)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// buildReport + renderReport
// ---------------------------------------------------------------------------
describe('buildReport', () => {
  const since = new Date('2025-05-01T00:00:00Z')
  const until = new Date('2025-05-31T23:59:59Z')

  const entries: TogglEntry[] = [
    {
      id: 1,
      description: '#83 some issue',
      duration: 3600,
      tags: ['ai'],
      start: '2025-05-10T10:00:00Z',
      stop: '2025-05-10T11:00:00Z',
    },
    {
      id: 2,
      description: '#84 another issue',
      duration: 1800,
      tags: ['human'],
      start: '2025-05-12T14:00:00Z',
      stop: '2025-05-12T14:30:00Z',
    },
    {
      id: 3,
      description: 'running',
      duration: -1,
      tags: ['ai'],
      start: '2025-05-13T09:00:00Z',
      stop: null,
    },
  ]

  const closedIssues = [
    { number: 83, title: 'Fix bug', closedAt: '2025-05-10T15:00:00Z', milestone: 'M1' },
    { number: 99, title: 'Old issue', closedAt: '2025-04-01T10:00:00Z', milestone: null }, // out of range
  ]

  const closedMilestones = [
    { number: 1, title: 'Milestone One', closedAt: '2025-05-20T10:00:00Z' },
    { number: 2, title: 'Old milestone', closedAt: '2025-03-01T10:00:00Z' }, // out of range
  ]

  it('computes correct totals', () => {
    const model = buildReport({ entries, closedIssues, closedMilestones, since, until })
    expect(model.totals.ai).toBe(3600)
    expect(model.totals.human).toBe(1800)
    expect(model.totals.other).toBe(0)
    expect(model.totals.total).toBe(5400)
  })

  it('filters closed issues to the range', () => {
    const model = buildReport({ entries, closedIssues, closedMilestones, since, until })
    expect(model.closedIssues).toHaveLength(1)
    expect(model.closedIssues[0]?.number).toBe(83)
  })

  it('filters closed milestones to the range', () => {
    const model = buildReport({ entries, closedIssues, closedMilestones, since, until })
    expect(model.closedMilestones).toHaveLength(1)
    expect(model.closedMilestones[0]?.title).toBe('Milestone One')
  })
})

describe('renderReport', () => {
  const model: ReportModel = {
    since: new Date('2025-05-01T00:00:00Z'),
    until: new Date('2025-05-31T23:59:59Z'),
    totals: { ai: 3600, human: 1800, other: 600, total: 6000 },
    closedIssues: [
      { number: 83, title: 'Fix bug', closedAt: '2025-05-10T15:00:00Z', milestone: 'M1' },
      { number: 84, title: 'No milestone', closedAt: '2025-05-12T10:00:00Z', milestone: null },
    ],
    closedMilestones: [{ number: 1, title: 'Milestone One', closedAt: '2025-05-20T10:00:00Z' }],
  }

  it('contains the date range header', () => {
    const out = renderReport(model)
    expect(out).toContain('2025-05-01')
    expect(out).toContain('2025-05-31')
  })

  it('contains time tracking labels', () => {
    const out = renderReport(model)
    expect(out).toContain('AI:')
    expect(out).toContain('Human:')
    expect(out).toContain('Other:')
    expect(out).toContain('Total:')
  })

  it('shows formatted durations', () => {
    const out = renderReport(model)
    expect(out).toContain('1h 0m') // AI: 3600s
    expect(out).toContain('30m') // Human: 1800s
    expect(out).toContain('10m') // Other: 600s
  })

  it('shows correct issues closed count', () => {
    const out = renderReport(model)
    expect(out).toContain('Issues closed (2)')
  })

  it('shows issue with milestone in parens', () => {
    const out = renderReport(model)
    expect(out).toContain('#83 Fix bug (M1)')
  })

  it('shows issue without milestone without parens', () => {
    const out = renderReport(model)
    expect(out).toContain('#84 No milestone')
    expect(out).not.toContain('#84 No milestone (')
  })

  it('shows correct milestones closed count', () => {
    const out = renderReport(model)
    expect(out).toContain('Milestones closed (1)')
  })

  it('lists milestone by number and title', () => {
    const out = renderReport(model)
    expect(out).toContain('#1 Milestone One')
  })
})

// ---------------------------------------------------------------------------
// serializeTrackState / parseTrackState
// ---------------------------------------------------------------------------
describe('serializeTrackState', () => {
  const state: TrackState = { issue: 42, repo: 'owner/name', description: '#42 Fix the bug' }

  it('round-trips back to an equal object via parseTrackState', () => {
    const raw = serializeTrackState(state)
    expect(parseTrackState(raw)).toEqual(state)
  })

  it('ends with a trailing newline', () => {
    const raw = serializeTrackState(state)
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('uses 2-space indentation', () => {
    const raw = serializeTrackState(state)
    // A 2-space-indented JSON object starts the second line with two spaces
    const lines = raw.split('\n')
    // At least one interior line should start with exactly two spaces
    expect(lines.some(l => /^ {2}[^ ]/.test(l))).toBe(true)
    // No interior line should start with four or more leading spaces from
    // top-level keys (top-level fields are indented 2, not 4)
    expect(lines.some(l => /^ {4}[^ ]/.test(l))).toBe(false)
  })
})

describe('parseTrackState', () => {
  const valid: TrackState = { issue: 7, repo: 'acme/repo', description: '#7 Some task' }

  it('parses a valid serialized state', () => {
    expect(parseTrackState(serializeTrackState(valid))).toEqual(valid)
  })

  it('returns null for invalid JSON', () => {
    expect(parseTrackState('not json at all {')).toBeNull()
  })

  it('returns null for a JSON number (non-object)', () => {
    expect(parseTrackState('5')).toBeNull()
  })

  it('returns null for JSON null', () => {
    expect(parseTrackState('null')).toBeNull()
  })

  it('returns null for a JSON array', () => {
    expect(parseTrackState('[]')).toBeNull()
  })

  it('returns null when issue field is missing', () => {
    const { issue: _omit, ...rest } = valid
    expect(parseTrackState(JSON.stringify(rest))).toBeNull()
  })

  it('returns null when repo field is missing', () => {
    const { repo: _omit, ...rest } = valid
    expect(parseTrackState(JSON.stringify(rest))).toBeNull()
  })

  it('returns null when description field is missing', () => {
    const { description: _omit, ...rest } = valid
    expect(parseTrackState(JSON.stringify(rest))).toBeNull()
  })

  it('returns null when issue is 0', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, issue: 0 }))).toBeNull()
  })

  it('returns null when issue is negative', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, issue: -1 }))).toBeNull()
  })

  it('returns null when issue is a non-integer number', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, issue: 1.5 }))).toBeNull()
  })

  it('returns null when issue is a string', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, issue: '7' }))).toBeNull()
  })

  it('returns null when repo is an empty string', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, repo: '' }))).toBeNull()
  })

  it('returns null when description is an empty string', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, description: '' }))).toBeNull()
  })

  it('returns null when repo is not a string', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, repo: 123 }))).toBeNull()
  })

  it('returns null when description is not a string', () => {
    expect(parseTrackState(JSON.stringify({ ...valid, description: true }))).toBeNull()
  })
})
