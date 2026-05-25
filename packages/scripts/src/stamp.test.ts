import { describe, it, expect } from 'vitest'
import { computeCycleTime, formatCycleTime, fieldJsonKey } from './stamp-pure.js'

// ---------------------------------------------------------------------------
// fieldJsonKey
// ---------------------------------------------------------------------------
describe('fieldJsonKey', () => {
  it('lowercases only the first character of a multi-word field with a space', () => {
    expect(fieldJsonKey('Actual Start')).toBe('actual Start')
  })

  it('lowercases only the first character of another multi-word field', () => {
    expect(fieldJsonKey('Started At')).toBe('started At')
  })

  it('is a no-op when the first character is already lowercase', () => {
    expect(fieldJsonKey('status')).toBe('status')
  })

  it('lowercases the first character of a single uppercase word', () => {
    expect(fieldJsonKey('Status')).toBe('status')
  })

  it('handles empty string safely', () => {
    expect(fieldJsonKey('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatCycleTime
// ---------------------------------------------------------------------------
describe('formatCycleTime', () => {
  it('returns "0m" for zero minutes', () => {
    expect(formatCycleTime(0)).toBe('0m')
  })

  it('returns "0m" for negative minutes (clamped)', () => {
    expect(formatCycleTime(-60)).toBe('0m')
  })

  it('returns "1m" for 1 minute', () => {
    expect(formatCycleTime(1)).toBe('1m')
  })

  it('returns "45m" for 45 minutes (under an hour)', () => {
    expect(formatCycleTime(45)).toBe('45m')
  })

  it('returns "59m" for 59 minutes', () => {
    expect(formatCycleTime(59)).toBe('59m')
  })

  it('returns "1h" for exactly 60 minutes (no trailing zero m)', () => {
    expect(formatCycleTime(60)).toBe('1h')
  })

  it('returns "1h 30m" for 90 minutes', () => {
    expect(formatCycleTime(90)).toBe('1h 30m')
  })

  it('returns "2h 30m" for 150 minutes', () => {
    expect(formatCycleTime(150)).toBe('2h 30m')
  })

  it('returns "2h" for exactly 120 minutes (no trailing zero m)', () => {
    expect(formatCycleTime(120)).toBe('2h')
  })

  it('returns "1d" for exactly 1440 minutes (no trailing zero h or m)', () => {
    expect(formatCycleTime(1440)).toBe('1d')
  })

  it('returns "1d 1h" for 1500 minutes (25h, no trailing zero m)', () => {
    expect(formatCycleTime(1500)).toBe('1d 1h')
  })

  it('returns "1d 1h 30m" for 1530 minutes', () => {
    expect(formatCycleTime(1530)).toBe('1d 1h 30m')
  })

  it('returns "1d 4h 30m" for a typical multi-day cycle (1710 min)', () => {
    expect(formatCycleTime(1710)).toBe('1d 4h 30m')
  })

  it('returns "3d" for 4320 minutes (72h)', () => {
    expect(formatCycleTime(4320)).toBe('3d')
  })

  it('omits days when zero even with hours and minutes', () => {
    // 2h 5m = 125 min — should not show "0d"
    expect(formatCycleTime(125)).toBe('2h 5m')
  })
})

// ---------------------------------------------------------------------------
// computeCycleTime
// ---------------------------------------------------------------------------
describe('computeCycleTime', () => {
  it('computes same-day minutes correctly', () => {
    const result = computeCycleTime('2026-05-25T10:00:00Z', '2026-05-25T10:45:00Z')
    expect(result.minutes).toBe(45)
    expect(result.human).toBe('45m')
  })

  it('computes multi-hour correctly (2h 30m)', () => {
    const result = computeCycleTime('2026-05-25T08:00:00Z', '2026-05-25T10:30:00Z')
    expect(result.minutes).toBe(150)
    expect(result.human).toBe('2h 30m')
  })

  it('computes multi-day correctly (1d 1h)', () => {
    const result = computeCycleTime('2026-05-24T09:00:00Z', '2026-05-25T10:00:00Z')
    expect(result.minutes).toBe(1500)
    expect(result.human).toBe('1d 1h')
  })

  it('returns 0 minutes and "0m" when finish equals start (zero duration)', () => {
    const result = computeCycleTime('2026-05-25T10:00:00Z', '2026-05-25T10:00:00Z')
    expect(result.minutes).toBe(0)
    expect(result.human).toBe('0m')
  })

  it('clamps to 0 when finish is before start (never negative)', () => {
    const result = computeCycleTime('2026-05-25T10:00:00Z', '2026-05-25T09:00:00Z')
    expect(result.minutes).toBe(0)
    expect(result.human).toBe('0m')
  })

  it('returns integer minutes (truncates sub-minute difference)', () => {
    // 45 min 30 sec → floor → 45 min
    const result = computeCycleTime('2026-05-25T10:00:00Z', '2026-05-25T10:45:30Z')
    expect(result.minutes).toBe(45)
    expect(result.human).toBe('45m')
  })

  it('handles cross-day boundary correctly', () => {
    // 23:30 → next day 00:00 = 30 min
    const result = computeCycleTime('2026-05-25T23:30:00Z', '2026-05-26T00:00:00Z')
    expect(result.minutes).toBe(30)
    expect(result.human).toBe('30m')
  })
})
