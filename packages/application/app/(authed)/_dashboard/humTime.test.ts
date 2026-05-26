import { describe, test, expect } from 'vitest'
import { formatRelativeTime } from './humTime'

// Fixed reference point: 2024-06-15T12:00:00.000Z = 1718452800000
const NOW = 1718452800000

describe('formatRelativeTime', () => {
  test('returns "just now" when diff is less than 60 seconds', () => {
    const iso = new Date(NOW - 30_000).toISOString() // 30s ago
    expect(formatRelativeTime(iso, NOW)).toBe('just now')
  })

  test('returns "just now" when diff is exactly 0', () => {
    const iso = new Date(NOW).toISOString()
    expect(formatRelativeTime(iso, NOW)).toBe('just now')
  })

  test('returns "<n>m ago" when diff is in minutes (< 60 min)', () => {
    const iso = new Date(NOW - 15 * 60_000).toISOString() // 15m ago
    expect(formatRelativeTime(iso, NOW)).toBe('15m ago')
  })

  test('returns "1m ago" at exactly 60 seconds', () => {
    const iso = new Date(NOW - 60_000).toISOString()
    expect(formatRelativeTime(iso, NOW)).toBe('1m ago')
  })

  test('returns "<n>h ago" when diff is in hours (< 24h)', () => {
    const iso = new Date(NOW - 3 * 3600_000).toISOString() // 3h ago
    expect(formatRelativeTime(iso, NOW)).toBe('3h ago')
  })

  test('returns "1h ago" at exactly 60 minutes', () => {
    const iso = new Date(NOW - 60 * 60_000).toISOString()
    expect(formatRelativeTime(iso, NOW)).toBe('1h ago')
  })

  test('returns "<n>d ago" when diff is in days (< 7d)', () => {
    const iso = new Date(NOW - 3 * 86400_000).toISOString() // 3d ago
    expect(formatRelativeTime(iso, NOW)).toBe('3d ago')
  })

  test('returns "1d ago" at exactly 24 hours', () => {
    const iso = new Date(NOW - 24 * 3600_000).toISOString()
    expect(formatRelativeTime(iso, NOW)).toBe('1d ago')
  })

  test('returns YYYY-MM-DD date string when diff >= 7 days', () => {
    const iso = new Date(NOW - 10 * 86400_000).toISOString() // 10d ago
    expect(formatRelativeTime(iso, NOW)).toBe(iso.slice(0, 10))
  })

  test('returns YYYY-MM-DD at exactly 7 days', () => {
    const iso = new Date(NOW - 7 * 86400_000).toISOString()
    expect(formatRelativeTime(iso, NOW)).toBe(iso.slice(0, 10))
  })

  test('returns empty string for empty input', () => {
    expect(formatRelativeTime('', NOW)).toBe('')
  })

  test('returns empty string for invalid ISO string', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('')
  })

  test('returns empty string for malformed date', () => {
    expect(formatRelativeTime('2024-99-99T99:99:99Z', NOW)).toBe('')
  })
})
