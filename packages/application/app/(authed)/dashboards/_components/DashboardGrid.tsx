'use client'

import GridLayout, { WidthProvider } from 'react-grid-layout'
import type ReactGridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { DashboardCardFrame } from './DashboardCardFrame'
import { CARD_META } from './registry'
import { cardsToLayout, layoutToCards, GRID_COLS, ROW_HEIGHT_PX } from './grid'
import type { DashboardCard } from '@monorepo-template/core/db/dashboards'

// Create the width-aware grid ONCE at module scope
const GridLayoutWithWidth = WidthProvider(GridLayout)

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardGridProps {
  cards: DashboardCard[]
  query: string
  editing: boolean
  isMobile: boolean
  onLayoutChange: (cards: DashboardCard[]) => void
  onRemoveCard: (cardId: string) => void
}

// ── DashboardGrid ──────────────────────────────────────────────────────────────

export function DashboardGrid({
  cards,
  query,
  editing,
  isMobile,
  onLayoutChange,
  onRemoveCard,
}: DashboardGridProps) {
  // ── Mobile: simple stacked CSS grid ────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridAutoRows: `${ROW_HEIGHT_PX}px`,
          gap: 12,
        }}
      >
        {cards.map((card) => {
          const { label, meta } = CARD_META[card.type] ?? { label: card.type, meta: '' }
          return (
            <div
              key={card.id}
              style={{ gridColumn: '1 / -1', gridRow: `span ${card.position.h}` }}
            >
              <DashboardCardFrame
                label={label}
                meta={meta}
                type={card.type}
                query={query}
                onRemove={() => onRemoveCard(card.id)}
              />
            </div>
          )
        })}
      </div>
    )
  }

  // ── Desktop: react-grid-layout ──────────────────────────────────────────────

  function handleDragStop(layout: ReactGridLayout.Layout[]) {
    onLayoutChange(layoutToCards(cards, layout))
  }

  function handleResizeStop(layout: ReactGridLayout.Layout[]) {
    onLayoutChange(layoutToCards(cards, layout))
  }

  return (
    <GridLayoutWithWidth
      className="dashboard-grid-layout"
      layout={cardsToLayout(cards).map((it) => ({ ...it, minW: 3, minH: 4 }))}
      cols={GRID_COLS}
      rowHeight={ROW_HEIGHT_PX}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      isBounded
      draggableHandle=".dashboard-card-drag-handle"
      compactType="vertical"
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
    >
      {cards.map((card) => {
        const { label, meta } = CARD_META[card.type] ?? { label: card.type, meta: '' }
        return (
          <div key={card.id}>
            {/* inner wrapper fills the RGL-sized item; flex column so the drag handle sits above the card */}
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {editing && (
                <div
                  className="dashboard-card-drag-handle"
                  style={{
                    height: 24,
                    flexShrink: 0,
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'var(--bg-sunken)',
                    border: '1px solid var(--border)',
                    borderBottom: 'none',
                    borderTopLeftRadius: 'var(--r-3)',
                    borderTopRightRadius: 'var(--r-3)',
                    color: 'var(--fg-3)',
                    font: '600 10px/1 var(--font-mono)',
                    letterSpacing: '0.04em',
                    userSelect: 'none',
                  }}
                >
                  ⠿ DRAG
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0 }}>
                <DashboardCardFrame
                  label={label}
                  meta={meta}
                  type={card.type}
                  query={query}
                  onRemove={() => onRemoveCard(card.id)}
                />
              </div>
            </div>
          </div>
        )
      })}
    </GridLayoutWithWidth>
  )
}
