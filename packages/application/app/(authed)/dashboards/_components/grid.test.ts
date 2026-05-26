import { describe, test, expect } from 'vitest'
import { cardGridStyle, nextCardPosition, DEFAULT_CARD, GRID_COLS } from './grid'
import type { DashboardCard } from '@monorepo-template/core/db/dashboards'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCard(
  id: string,
  x: number,
  y: number,
  w = DEFAULT_CARD.w,
  h = DEFAULT_CARD.h,
): DashboardCard {
  return {
    id,
    type: 'mentions',
    position: { x, y, w, h },
    options: {},
  }
}

// ── cardGridStyle ─────────────────────────────────────────────────────────────

describe('cardGridStyle', () => {
  test('converts 0-based x/y to 1-based CSS grid lines', () => {
    const style = cardGridStyle({ x: 0, y: 0, w: 6, h: 9 })
    expect(style.gridColumn).toBe('1 / span 6')
    expect(style.gridRow).toBe('1 / span 9')
  })

  test('handles non-zero x/y', () => {
    const style = cardGridStyle({ x: 6, y: 3, w: 6, h: 9 })
    expect(style.gridColumn).toBe('7 / span 6')
    expect(style.gridRow).toBe('4 / span 9')
  })

  test('handles full-width card (w=12)', () => {
    const style = cardGridStyle({ x: 0, y: 0, w: 12, h: 4 })
    expect(style.gridColumn).toBe('1 / span 12')
    expect(style.gridRow).toBe('1 / span 4')
  })
})

// ── nextCardPosition ──────────────────────────────────────────────────────────

describe('nextCardPosition', () => {
  test('places the first card at the origin, left column', () => {
    const pos = nextCardPosition([])
    expect(pos).toEqual({ x: 0, y: 0, w: DEFAULT_CARD.w, h: DEFAULT_CARD.h })
  })

  test('places the second card in the right column, same row as the first', () => {
    const cards = [makeCard('a', 0, 0)]
    const pos = nextCardPosition(cards)
    expect(pos.x).toBe(GRID_COLS / 2) // 6
    expect(pos.y).toBe(0)
  })

  test('places the third card in the left column below the first row', () => {
    const cards = [makeCard('a', 0, 0), makeCard('b', 6, 0)]
    const pos = nextCardPosition(cards)
    expect(pos.x).toBe(0)
    expect(pos.y).toBe(DEFAULT_CARD.h) // 9
  })

  test('places the fourth card in the right column of the second row', () => {
    const cards = [
      makeCard('a', 0, 0),
      makeCard('b', 6, 0),
      makeCard('c', 0, DEFAULT_CARD.h),
    ]
    const pos = nextCardPosition(cards)
    expect(pos.x).toBe(GRID_COLS / 2) // 6
    // Same row as card 'c'
    expect(pos.y).toBe(DEFAULT_CARD.h)
  })

  test('y is always non-negative', () => {
    const pos = nextCardPosition([makeCard('a', 0, 0)])
    expect(pos.y).toBeGreaterThanOrEqual(0)
  })

  test('is deterministic — same input always gives same output', () => {
    const cards = [makeCard('a', 0, 0), makeCard('b', 6, 0)]
    expect(nextCardPosition(cards)).toEqual(nextCardPosition(cards))
  })
})
