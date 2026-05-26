import type { DashboardCard, DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { nextCardPosition } from './grid'

export const HUM_ADD_CONTEXT_EVENT = 'hum:add-context'

export interface HumContextItem {
  source: 'dashboard-card' | 'analytics-card'
  cardType: DashboardCardType
  label: string
  query: string
  ticker?: string
}

/**
 * Builds the structured payload describing a dashboard card to hand to Hum.
 * Pure — trims label/query; includes ticker only when non-empty after trim.
 */
export function buildHumContextItem(input: {
  cardType: DashboardCardType
  label: string
  query: string
  ticker?: string
  source?: 'dashboard-card' | 'analytics-card'
}): HumContextItem {
  const ticker = input.ticker?.trim()
  const item: HumContextItem = {
    source: input.source ?? 'dashboard-card',
    cardType: input.cardType,
    label: input.label.trim(),
    query: input.query.trim(),
  }
  if (ticker) item.ticker = ticker
  return item
}

/**
 * Produces a copy of `card` suitable for appending to a different dashboard:
 * a fresh id (injected so this stays pure/testable), the same type + options,
 * and a position computed from the target dashboard's existing cards.
 */
export function copyCardForDashboard(
  card: DashboardCard,
  targetCards: DashboardCard[],
  newId: string,
): DashboardCard {
  return {
    id: newId,
    type: card.type,
    position: nextCardPosition(targetCards),
    options: { ...card.options },
  }
}

/**
 * Dispatches a window CustomEvent carrying the card context. The M3 Hum
 * slide-out will listen for HUM_ADD_CONTEXT_EVENT and consume the detail.
 * SSR-guarded no-op on the server.
 */
export function addHumContext(item: HumContextItem): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(HUM_ADD_CONTEXT_EVENT, { detail: item }))
}
