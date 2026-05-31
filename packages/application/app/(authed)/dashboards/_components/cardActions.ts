import type { DashboardCard, DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { nextCardPosition, GRID_COLS, DEFAULT_CARD } from './grid'
import { dashboardScopeQuery } from './scope'

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
 * Returns the effective query for an analytics card:
 * - If card.options.query is a non-empty string (after trim), returns that.
 * - Otherwise falls back to dashboardScopeQuery({ ticker, query }).
 *
 * Pure — no React, no side-effects.
 */
export function resolveCardQuery(
  card: DashboardCard,
  dashboard: { ticker?: string; query?: string },
): string {
  const cardQuery =
    typeof card.options.query === 'string' ? card.options.query.trim() : ''
  return cardQuery || dashboardScopeQuery(dashboard)
}

/**
 * Returns the effective symbol for a candlestick card:
 * - If card.options.ticker is a non-empty string (after trim), returns that.
 * - Else if dashboard.ticker is a non-empty string (after trim), returns that.
 * - Else falls back to dashboardScopeQuery({ ticker, query }).
 *
 * Mirrors the `ticker?.trim() || query` resolution that CardBody uses,
 * with the per-card options.ticker taking precedence over the dashboard ticker.
 *
 * Pure — no React, no side-effects.
 */
export function resolveCardSymbol(
  card: DashboardCard,
  dashboard: { ticker?: string; query?: string },
): string {
  const cardTicker =
    typeof card.options.ticker === 'string' ? card.options.ticker.trim() : ''
  if (cardTicker) return cardTicker

  const dashTicker = dashboard.ticker?.trim()
  if (dashTicker) return dashTicker

  return dashboardScopeQuery(dashboard)
}

// ── Selection helpers ────────────────────────────────────────────────────────

/**
 * Given a set of cards (the ones currently selected), returns which bulk scope
 * actions are available:
 * - canChangeQuery: at least one card is NOT a candlestick (analytics cards have a query)
 * - canChangeTicker: at least one card IS a candlestick
 *
 * Pure — no React, no side-effects.
 */
export function selectionScopeAvailability(cards: DashboardCard[]): {
  canChangeQuery: boolean
  canChangeTicker: boolean
} {
  let canChangeQuery = false
  let canChangeTicker = false
  for (const card of cards) {
    if (card.type === 'candlestick') {
      canChangeTicker = true
    } else {
      canChangeQuery = true
    }
    if (canChangeQuery && canChangeTicker) break
  }
  return { canChangeQuery, canChangeTicker }
}

/**
 * Returns a NEW cards array with the given field set on each selected card.
 * - field 'query' is only applied to non-candlestick cards (analytics)
 * - field 'ticker' is only applied to candlestick cards
 * Mixed selections do the right thing: only the matching type is updated.
 * Inputs are never mutated.
 *
 * Pure — no React, no side-effects.
 */
export function applyScopeToSelectedCards(
  cards: DashboardCard[],
  selectedIds: Set<string> | string[],
  field: 'query' | 'ticker',
  value: string,
): DashboardCard[] {
  const idSet: Set<string> =
    selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  const trimmed = value.trim()

  return cards.map((card) => {
    if (!idSet.has(card.id)) return card

    // Type-gating: query only for analytics, ticker only for candlestick
    if (field === 'query' && card.type === 'candlestick') return card
    if (field === 'ticker' && card.type !== 'candlestick') return card

    return {
      ...card,
      options: { ...card.options, [field]: trimmed },
    }
  })
}

// ── Ingestion result helper ─────────────────────────────────────────────────

/**
 * Maps an HTTP status (and optional response body) from POST /api/query to a
 * user-facing message. Pure — no fetch, no side-effects.
 *
 * Returns `{ ok: true, message }` on success (2xx), `{ ok: false, message }`
 * on every error path. The caller is responsible for building abort/network
 * error messages itself (those have no HTTP status to dispatch on).
 */
export function describeIngestResult(
  status: number,
  body: { error?: string } | null,
): { ok: boolean; message: string } {
  if (status === 200 || status === 201) {
    return { ok: true, message: 'Data fetch started — charts will update shortly.' }
  }
  if (status === 402) {
    return { ok: false, message: 'Monthly query limit reached — upgrade to fetch data for new queries.' }
  }
  if (status === 403 && body?.error === 'byok_required') {
    return { ok: false, message: 'Add your twitterapi.io API key in Account → API keys to fetch data for new queries.' }
  }
  return { ok: false, message: `Could not fetch data (${status}).` }
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
