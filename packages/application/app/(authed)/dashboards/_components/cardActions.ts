import type { DashboardCard, DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { nextCardPosition, GRID_COLS, DEFAULT_CARD } from './grid'

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

/**
 * Canonical ordered list of every analytics card type rendered by
 * AnalyticsChartGrid. Single source of truth for "pin the whole query".
 * Keep in sync with AnalyticsChartGrid.tsx.
 */
export const ANALYTICS_CARD_TYPES: readonly DashboardCardType[] = [
  'hashtags', 'mentions', 'domains', 'bio-domains', 'symbol-rate', 'engagement',
  'sentiment', 'sentiment-timeline', 'keywords', 'conversation-depth', 'geo',
  'languages', 'sources', 'verification', 'bot-ratio', 'posting-heatmap',
  'content-length', 'author-influence',
] as const

/**
 * Builds the full set of dashboard cards for a query — one card per analytics
 * card type, with the query string baked into each card's options. Positions
 * tile against an initially-empty board via nextCardPosition. The `idFactory`
 * is injected so this stays pure/testable (callers pass crypto.randomUUID).
 */
export function buildQueryDashboardCards(
  query: string,
  idFactory: () => string,
): DashboardCard[] {
  const cards: DashboardCard[] = []
  for (const type of ANALYTICS_CARD_TYPES) {
    const card: DashboardCard = {
      id: idFactory(),
      type,
      position: nextCardPosition(cards),
      options: { query },
    }
    cards.push(card)
  }
  return cards
}

/**
 * Builds the initial set of cards for a newly-created dashboard based on
 * its ticker and/or query scope. If a ticker is given, a full-width
 * candlestick card is prepended. If a query is given, all 18 analytics
 * cards are appended below (tiled two-per-row). The `idFactory` is injected
 * so this stays pure/testable (callers pass crypto.randomUUID).
 */
export function buildInitialDashboardCards(
  scope: { ticker?: string; query?: string },
  idFactory: () => string,
): DashboardCard[] {
  const ticker = scope.ticker?.trim()
  const query = scope.query?.trim()
  const cards: DashboardCard[] = []
  let rowStart = 0

  if (ticker) {
    cards.push({
      id: idFactory(),
      type: 'candlestick',
      position: { x: 0, y: 0, w: GRID_COLS, h: 12 },
      options: {},
    })
    rowStart = 12
  }

  if (query) {
    ANALYTICS_CARD_TYPES.forEach((type, i) => {
      cards.push({
        id: idFactory(),
        type,
        position: {
          x: (i % 2) * (GRID_COLS / 2),
          y: rowStart + Math.floor(i / 2) * DEFAULT_CARD.h,
          w: DEFAULT_CARD.w,
          h: DEFAULT_CARD.h,
        },
        options: { query },
      })
    })
  }

  return cards
}
