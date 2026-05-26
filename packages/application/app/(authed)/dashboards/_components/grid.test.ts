import { describe, test, expect } from 'vitest'
import { cardGridStyle, nextCardPosition, cardsToLayout, layoutToCards, DEFAULT_CARD, GRID_COLS } from './grid'
import type { GridLayoutItem } from './grid'
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

// ── cardsToLayout ─────────────────────────────────────────────────────────────

describe('cardsToLayout', () => {
  test('maps a single card correctly', () => {
    const cards = [makeCard('c1', 0, 0, 6, 9)]
    expect(cardsToLayout(cards)).toEqual([{ i: 'c1', x: 0, y: 0, w: 6, h: 9 }])
  })

  test('maps multiple cards and preserves input order', () => {
    const cards = [makeCard('a', 0, 0, 6, 9), makeCard('b', 6, 0, 6, 9), makeCard('c', 0, 9, 12, 4)]
    const layout = cardsToLayout(cards)
    expect(layout).toHaveLength(3)
    expect(layout[0]).toEqual({ i: 'a', x: 0, y: 0, w: 6, h: 9 })
    expect(layout[1]).toEqual({ i: 'b', x: 6, y: 0, w: 6, h: 9 })
    expect(layout[2]).toEqual({ i: 'c', x: 0, y: 9, w: 12, h: 4 })
  })

  test('returns an empty array for empty input', () => {
    expect(cardsToLayout([])).toEqual([])
  })
})

// ── layoutToCards ─────────────────────────────────────────────────────────────

describe('layoutToCards', () => {
  test('updates position from matching layout item by id', () => {
    const cards = [makeCard('a', 0, 0, 6, 9)]
    const layout: GridLayoutItem[] = [{ i: 'a', x: 2, y: 3, w: 4, h: 5 }]
    const result = layoutToCards(cards, layout)
    expect(result[0].position).toEqual({ x: 2, y: 3, w: 4, h: 5 })
  })

  test('preserves the original cards order even when layout is in a different order', () => {
    const cards = [makeCard('first', 0, 0), makeCard('second', 6, 0), makeCard('third', 0, 9)]
    const layout: GridLayoutItem[] = [
      { i: 'third', x: 0, y: 18, w: 12, h: 4 },
      { i: 'first', x: 0, y: 0, w: 6, h: 9 },
      { i: 'second', x: 6, y: 0, w: 6, h: 9 },
    ]
    const result = layoutToCards(cards, layout)
    expect(result[0].id).toBe('first')
    expect(result[1].id).toBe('second')
    expect(result[2].id).toBe('third')
    expect(result[2].position.y).toBe(18)
  })

  test('preserves type and options on each card', () => {
    const card: DashboardCard = {
      id: 'x',
      type: 'mentions',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: { token: 'BTC', limit: 10 },
    }
    const layout: GridLayoutItem[] = [{ i: 'x', x: 1, y: 2, w: 3, h: 4 }]
    const result = layoutToCards([card], layout)
    expect(result[0].type).toBe('mentions')
    expect(result[0].options).toEqual({ token: 'BTC', limit: 10 })
  })

  test('leaves a card unchanged when no layout item matches its id', () => {
    const card = makeCard('orphan', 3, 5, 4, 4)
    const layout: GridLayoutItem[] = [{ i: 'other', x: 0, y: 0, w: 6, h: 9 }]
    const result = layoutToCards([card], layout)
    expect(result[0]).toBe(card) // same reference
    expect(result[0].position).toEqual({ x: 3, y: 5, w: 4, h: 4 })
  })

  test('rounds and clamps fractional/negative values', () => {
    const card = makeCard('r', 0, 0, 6, 9)
    const layout: GridLayoutItem[] = [{ i: 'r', x: -1, y: 2.7, w: 0, h: 5.2 }]
    const result = layoutToCards([card], layout)
    expect(result[0].position).toEqual({ x: 0, y: 3, w: 1, h: 5 })
  })

  test('does not mutate the input card position objects', () => {
    const card = makeCard('m', 1, 2, 3, 4)
    const originalPos = { ...card.position }
    const layout: GridLayoutItem[] = [{ i: 'm', x: 5, y: 6, w: 7, h: 8 }]
    layoutToCards([card], layout)
    expect(card.position).toEqual(originalPos)
  })
})
