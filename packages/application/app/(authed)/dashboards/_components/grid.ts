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
