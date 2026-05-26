import type { DashboardCard } from '@monorepo-template/core/db/dashboards'

// ── Constants ─────────────────────────────────────────────────────────────────

export const GRID_COLS = 12
export const DEFAULT_CARD = { w: 6, h: 9 } // 9 × 30px = 270px tall by default
export const ROW_HEIGHT_PX = 30

// ── cardGridStyle ──────────────────────────────────────────────────────────────

/**
 * Converts a card position to CSS grid placement properties.
 * Positions use 0-based x/y; CSS grid lines are 1-based.
 */
export function cardGridStyle(pos: {
  x: number
  y: number
  w: number
  h: number
}): React.CSSProperties {
  return {
    gridColumn: `${pos.x + 1} / span ${pos.w}`,
    gridRow: `${pos.y + 1} / span ${pos.h}`,
  }
}

// ── nextCardPosition ───────────────────────────────────────────────────────────

/**
 * Returns the position for a new card to be appended.
 *
 * Strategy: fill two cards per row left-to-right (x alternates 0/6),
 * starting below the current bottom of all existing cards.
 * Always deterministic — depends only on the number of existing cards.
 */
export function nextCardPosition(
  cards: DashboardCard[],
): { x: number; y: number; w: number; h: number } {
  const { w, h } = DEFAULT_CARD

  // Find the row immediately below the bottom-most card
  let maxBottom = 0
  for (const card of cards) {
    const bottom = card.position.y + card.position.h
    if (bottom > maxBottom) maxBottom = bottom
  }

  // Count the number of default-sized slots already placed in the bottom row.
  // We use the simple heuristic: total number of cards mod 2 gives the column slot.
  const slotInRow = cards.length % 2 // 0 → left column, 1 → right column
  const x = slotInRow === 0 ? 0 : GRID_COLS / 2 // 0 or 6

  // If this is the first card in a new row (slotInRow === 0), start at maxBottom.
  // If it's the second card, stay at the same row as the previous card.
  const y = slotInRow === 0 ? maxBottom : maxBottom - h

  return { x, y: Math.max(0, y), w, h }
}

// ── Layout conversion helpers ──────────────────────────────────────────────────

/** A single react-grid-layout item (defined locally to avoid a direct dependency). */
export interface GridLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Converts an array of dashboard cards to a react-grid-layout `Layout` array.
 * Preserves input order. Maps `card.id` → `i` and `card.position` → `x/y/w/h`.
 */
export function cardsToLayout(cards: DashboardCard[]): GridLayoutItem[] {
  return cards.map((card) => ({
    i: card.id,
    x: card.position.x,
    y: card.position.y,
    w: card.position.w,
    h: card.position.h,
  }))
}

/**
 * Applies an updated react-grid-layout `Layout` back onto a cards array.
 *
 * - Preserves the ORDER of `cards` (not the order of `layout`).
 * - For each card, finds the layout item with `i === card.id` and replaces
 *   `position` with sanitised values: x/y floored at 0, w/h floored at 1,
 *   all rounded to the nearest integer.
 * - Cards with no matching layout item are returned unchanged (same reference).
 * - Pure: never mutates the input cards or their position objects.
 */
export function layoutToCards(
  cards: DashboardCard[],
  layout: GridLayoutItem[],
): DashboardCard[] {
  const byId = new Map(layout.map((item) => [item.i, item]))
  return cards.map((card) => {
    const item = byId.get(card.id)
    if (!item) return card
    return {
      ...card,
      position: {
        x: Math.max(0, Math.round(item.x)),
        y: Math.max(0, Math.round(item.y)),
        w: Math.max(1, Math.round(item.w)),
        h: Math.max(1, Math.round(item.h)),
      },
    }
  })
}
