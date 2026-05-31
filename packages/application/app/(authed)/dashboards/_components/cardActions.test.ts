import { describe, test, expect } from 'vitest'
import { buildHumContextItem, copyCardForDashboard, buildQueryDashboardCards, buildInitialDashboardCards, ANALYTICS_CARD_TYPES, resolveCardQuery, resolveCardSymbol, selectionScopeAvailability, applyScopeToSelectedCards, describeIngestResult } from './cardActions'
import type { DashboardCard } from '@monorepo-template/core/db/dashboards'

describe('buildHumContextItem', () => {
  test('includes ticker when provided and non-empty', () => {
    const item = buildHumContextItem({
      cardType: 'mentions',
      label: 'BTC Mentions',
      query: 'bitcoin',
      ticker: 'BTC',
    })
    expect(item.ticker).toBe('BTC')
  })

  test('omits ticker key entirely when ticker is undefined', () => {
    const item = buildHumContextItem({
      cardType: 'mentions',
      label: 'General',
      query: 'crypto',
    })
    expect('ticker' in item).toBe(false)
  })

  test('omits ticker when it is blank or whitespace-only', () => {
    const item = buildHumContextItem({
      cardType: 'mentions',
      label: 'Test',
      query: 'test',
      ticker: '   ',
    })
    expect('ticker' in item).toBe(false)
  })

  test('trims whitespace from label and query', () => {
    const item = buildHumContextItem({
      cardType: 'mentions',
      label: '  BTC Mentions  ',
      query: '  bitcoin news  ',
    })
    expect(item.label).toBe('BTC Mentions')
    expect(item.query).toBe('bitcoin news')
  })

  test('always sets source to dashboard-card and passes through cardType', () => {
    const item = buildHumContextItem({
      cardType: 'sentiment',
      label: 'Test',
      query: 'test',
    })
    expect(item.source).toBe('dashboard-card')
    expect(item.cardType).toBe('sentiment')
  })

  test('uses analytics-card source when source is explicitly passed as analytics-card', () => {
    const item = buildHumContextItem({
      cardType: 'mentions',
      label: 'Analytics Mentions',
      query: 'bitcoin',
      source: 'analytics-card',
    })
    expect(item.source).toBe('analytics-card')
  })
})

describe('copyCardForDashboard', () => {
  test('uses the injected newId, not the source card id', () => {
    const sourceCard: DashboardCard = {
      id: 'card-1',
      type: 'mentions',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: { threshold: 10 },
    }
    const copy = copyCardForDashboard(sourceCard, [], 'new-card-id')
    expect(copy.id).toBe('new-card-id')
  })

  test('preserves type and options values', () => {
    const sourceCard: DashboardCard = {
      id: 'card-1',
      type: 'sentiment',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: { limit: 5, sortBy: 'score' },
    }
    const copy = copyCardForDashboard(sourceCard, [], 'new-id')
    expect(copy.type).toBe('sentiment')
    expect(copy.options).toEqual({ limit: 5, sortBy: 'score' })
  })

  test('returns a NEW options object (not the same reference)', () => {
    const sourceCard: DashboardCard = {
      id: 'card-1',
      type: 'mentions',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: { threshold: 10 },
    }
    const copy = copyCardForDashboard(sourceCard, [], 'new-id')
    expect(copy.options).not.toBe(sourceCard.options)
    // Verify mutation of source doesn't affect copy
    sourceCard.options.threshold = 20
    expect(copy.options.threshold).toBe(10)
  })

  test('sets position from nextCardPosition: empty targetCards yields { x: 0, y: 0, w: 6, h: 9 }', () => {
    const sourceCard: DashboardCard = {
      id: 'card-1',
      type: 'mentions',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: {},
    }
    const copy = copyCardForDashboard(sourceCard, [], 'new-id')
    expect(copy.position).toEqual({ x: 0, y: 0, w: 6, h: 9 })
  })

  test('sets position correctly when targetCards is not empty', () => {
    const sourceCard: DashboardCard = {
      id: 'card-1',
      type: 'mentions',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: {},
    }
    const existingCard: DashboardCard = {
      id: 'existing-1',
      type: 'sentiment',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: {},
    }
    const copy = copyCardForDashboard(sourceCard, [existingCard], 'new-id')
    // With one existing card, the next position should be x: 6 (right column), y: 0 (same row)
    expect(copy.position).toEqual({ x: 6, y: 0, w: 6, h: 9 })
  })
})

describe('buildQueryDashboardCards', () => {
  test('returns one card per ANALYTICS_CARD_TYPES, in the same order', () => {
    let counter = 0
    const idFactory = () => `id-${counter++}`
    const cards = buildQueryDashboardCards('bitcoin', idFactory)
    expect(cards.map((c) => c.type)).toEqual([...ANALYTICS_CARD_TYPES])
  })

  test('every card options.query equals the passed query', () => {
    let counter = 0
    const idFactory = () => `id-${counter++}`
    const cards = buildQueryDashboardCards('ethereum news', idFactory)
    for (const card of cards) {
      expect(card.options.query).toBe('ethereum news')
    }
  })

  test('uses the injected idFactory for card ids', () => {
    let counter = 0
    const idFactory = () => `id-${counter++}`
    const cards = buildQueryDashboardCards('test', idFactory)
    expect(cards.map((c) => c.id)).toEqual(
      ANALYTICS_CARD_TYPES.map((_, i) => `id-${i}`)
    )
  })

  test('each card options is a distinct object reference', () => {
    const idFactory = () => crypto.randomUUID()
    const cards = buildQueryDashboardCards('solana', idFactory)
    const optionRefs = cards.map((c) => c.options)
    // Check no two are the same reference
    for (let i = 0; i < optionRefs.length; i++) {
      for (let j = i + 1; j < optionRefs.length; j++) {
        expect(optionRefs[i]).not.toBe(optionRefs[j])
      }
    }
  })

  test('positions tile two-per-row: first card {x:0,y:0,w:6,h:9}, second {x:6,y:0}, third {x:0,y:9}', () => {
    let counter = 0
    const idFactory = () => `id-${counter++}`
    const cards = buildQueryDashboardCards('xrp', idFactory)
    expect(cards[0].position).toEqual({ x: 0, y: 0, w: 6, h: 9 })
    expect(cards[1].position).toEqual({ x: 6, y: 0, w: 6, h: 9 })
    expect(cards[2].position).toEqual({ x: 0, y: 9, w: 6, h: 9 })
  })
})

describe('buildInitialDashboardCards', () => {
  function makeIdFactory() {
    let counter = 0
    return () => `id-${counter++}`
  }

  test('ticker only → exactly 1 card, type candlestick, full-width position, empty options', () => {
    const cards = buildInitialDashboardCards({ ticker: 'BTC' }, makeIdFactory())
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('candlestick')
    expect(cards[0].position).toEqual({ x: 0, y: 0, w: 12, h: 12 })
    expect(cards[0].options).toEqual({})
    expect(cards[0].id).toBe('id-0')
  })

  test('query only → exactly 18 cards, types equal to ANALYTICS_CARD_TYPES in order, no candlestick', () => {
    const cards = buildInitialDashboardCards({ query: 'bitcoin' }, makeIdFactory())
    expect(cards).toHaveLength(18)
    expect(cards.map((c) => c.type)).toEqual([...ANALYTICS_CARD_TYPES])
    expect(cards.every((c) => c.type !== 'candlestick')).toBe(true)
  })

  test('query only → every card options.query equals the passed query', () => {
    const cards = buildInitialDashboardCards({ query: 'ethereum news' }, makeIdFactory())
    for (const card of cards) {
      expect(card.options.query).toBe('ethereum news')
    }
  })

  test('query only → first card {x:0,y:0,w:6,h:9}, second {x:6,y:0,w:6,h:9}, third {x:0,y:9,w:6,h:9}', () => {
    const cards = buildInitialDashboardCards({ query: 'solana' }, makeIdFactory())
    expect(cards[0].position).toEqual({ x: 0, y: 0, w: 6, h: 9 })
    expect(cards[1].position).toEqual({ x: 6, y: 0, w: 6, h: 9 })
    expect(cards[2].position).toEqual({ x: 0, y: 9, w: 6, h: 9 })
  })

  test('both ticker and query → 19 cards total; first is candlestick at top', () => {
    const cards = buildInitialDashboardCards({ ticker: 'ETH', query: 'ethereum' }, makeIdFactory())
    expect(cards).toHaveLength(19)
    expect(cards[0].type).toBe('candlestick')
    expect(cards[0].position).toEqual({ x: 0, y: 0, w: 12, h: 12 })
  })

  test('both ticker and query → first analytics card starts at y:12', () => {
    const cards = buildInitialDashboardCards({ ticker: 'ETH', query: 'ethereum' }, makeIdFactory())
    expect(cards[1].position).toEqual({ x: 0, y: 12, w: 6, h: 9 })
    expect(cards[2].position).toEqual({ x: 6, y: 12, w: 6, h: 9 })
    expect(cards[3].position).toEqual({ x: 0, y: 21, w: 6, h: 9 })
  })

  test('neither ticker nor query → empty array', () => {
    const cards = buildInitialDashboardCards({}, makeIdFactory())
    expect(cards).toEqual([])
  })

  test('whitespace-only ticker is treated as absent', () => {
    const cards = buildInitialDashboardCards({ ticker: '   ', query: 'bitcoin' }, makeIdFactory())
    expect(cards).toHaveLength(18)
    expect(cards[0].type).not.toBe('candlestick')
  })

  test('whitespace-only query is treated as absent', () => {
    const cards = buildInitialDashboardCards({ ticker: 'BTC', query: '   ' }, makeIdFactory())
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('candlestick')
  })

  test('query is trimmed before being stored in options', () => {
    const cards = buildInitialDashboardCards({ query: '  ai agents  ' }, makeIdFactory())
    for (const card of cards) {
      expect(card.options.query).toBe('ai agents')
    }
  })

  test('ids come only from the injected idFactory in call order', () => {
    const cards = buildInitialDashboardCards({ ticker: 'BTC', query: 'bitcoin' }, makeIdFactory())
    expect(cards.map((c) => c.id)).toEqual(
      Array.from({ length: 19 }, (_, i) => `id-${i}`)
    )
  })
})

// ── resolveCardQuery ────────────────────────────────────────────────────────

describe('resolveCardQuery', () => {
  function makeCard(overrides: Partial<DashboardCard['options']> = {}): DashboardCard {
    return {
      id: 'card-1',
      type: 'mentions',
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: { ...overrides },
    }
  }

  test('returns card options.query when it is a non-empty string', () => {
    const card = makeCard({ query: 'bitcoin' })
    expect(resolveCardQuery(card, { query: 'ethereum', ticker: 'ETH' })).toBe('bitcoin')
  })

  test('falls back to dashboardScopeQuery when card options.query is absent', () => {
    const card = makeCard()
    expect(resolveCardQuery(card, { query: 'ethereum', ticker: 'ETH' })).toBe('ETH ethereum')
  })

  test('falls back to dashboardScopeQuery when card options.query is an empty string', () => {
    const card = makeCard({ query: '' })
    expect(resolveCardQuery(card, { query: 'solana' })).toBe('solana')
  })

  test('falls back to dashboardScopeQuery when card options.query is whitespace-only', () => {
    const card = makeCard({ query: '   ' })
    expect(resolveCardQuery(card, { query: 'dogecoin' })).toBe('dogecoin')
  })

  test('returns trimmed card options.query (leading/trailing spaces stripped)', () => {
    const card = makeCard({ query: '  xrp news  ' })
    expect(resolveCardQuery(card, { query: 'fallback' })).toBe('xrp news')
  })

  test('falls back to dashboardScopeQuery when both ticker and query are on the dashboard', () => {
    const card = makeCard()
    expect(resolveCardQuery(card, { ticker: 'BTC', query: 'bitcoin' })).toBe('BTC bitcoin')
  })

  test('returns empty string when card has no options.query and dashboard has neither ticker nor query', () => {
    const card = makeCard()
    expect(resolveCardQuery(card, {})).toBe('')
  })
})

// ── resolveCardSymbol ───────────────────────────────────────────────────────

describe('resolveCardSymbol', () => {
  function makeCard(overrides: Partial<DashboardCard['options']> = {}): DashboardCard {
    return {
      id: 'card-1',
      type: 'candlestick',
      position: { x: 0, y: 0, w: 12, h: 12 },
      options: { ...overrides },
    }
  }

  test('returns card options.ticker when it is a non-empty string (highest precedence)', () => {
    const card = makeCard({ ticker: 'ETH' })
    expect(resolveCardSymbol(card, { ticker: 'BTC', query: 'bitcoin' })).toBe('ETH')
  })

  test('falls back to dashboard.ticker when card options.ticker is absent', () => {
    const card = makeCard()
    expect(resolveCardSymbol(card, { ticker: 'BTC', query: 'bitcoin' })).toBe('BTC')
  })

  test('falls back to dashboard.ticker when card options.ticker is empty string', () => {
    const card = makeCard({ ticker: '' })
    expect(resolveCardSymbol(card, { ticker: 'SOL', query: 'solana' })).toBe('SOL')
  })

  test('falls back to dashboard.ticker when card options.ticker is whitespace-only', () => {
    const card = makeCard({ ticker: '   ' })
    expect(resolveCardSymbol(card, { ticker: 'DOGE' })).toBe('DOGE')
  })

  test('falls back to dashboardScopeQuery when neither card nor dashboard has a ticker', () => {
    const card = makeCard()
    expect(resolveCardSymbol(card, { query: 'dogecoin' })).toBe('dogecoin')
  })

  test('falls back to dashboardScopeQuery combining ticker+query when card has no ticker and dashboard.ticker is absent', () => {
    const card = makeCard()
    expect(resolveCardSymbol(card, { ticker: undefined, query: 'ethereum news' })).toBe('ethereum news')
  })

  test('returns empty string when card, dashboard.ticker, and dashboard.query are all absent/empty', () => {
    const card = makeCard()
    expect(resolveCardSymbol(card, {})).toBe('')
  })

  test('returns trimmed card options.ticker (leading/trailing spaces stripped)', () => {
    const card = makeCard({ ticker: '  BNB  ' })
    expect(resolveCardSymbol(card, { ticker: 'ETH' })).toBe('BNB')
  })

  test('card options.ticker beats dashboard.ticker even when dashboard.ticker is non-empty', () => {
    const card = makeCard({ ticker: 'LINK' })
    expect(resolveCardSymbol(card, { ticker: 'BTC', query: 'bitcoin' })).toBe('LINK')
  })
})

// ── selectionScopeAvailability ──────────────────────────────────────────────

describe('selectionScopeAvailability', () => {
  function makeAnalytics(id: string): DashboardCard {
    return { id, type: 'mentions', position: { x: 0, y: 0, w: 6, h: 9 }, options: {} }
  }
  function makeCandlestick(id: string): DashboardCard {
    return { id, type: 'candlestick', position: { x: 0, y: 0, w: 12, h: 12 }, options: {} }
  }

  test('empty selection → both false', () => {
    const result = selectionScopeAvailability([])
    expect(result).toEqual({ canChangeQuery: false, canChangeTicker: false })
  })

  test('analytics-only selection → canChangeQuery true, canChangeTicker false', () => {
    const result = selectionScopeAvailability([makeAnalytics('a'), makeAnalytics('b')])
    expect(result).toEqual({ canChangeQuery: true, canChangeTicker: false })
  })

  test('candlestick-only selection → canChangeQuery false, canChangeTicker true', () => {
    const result = selectionScopeAvailability([makeCandlestick('c1'), makeCandlestick('c2')])
    expect(result).toEqual({ canChangeQuery: false, canChangeTicker: true })
  })

  test('mixed selection → both true', () => {
    const result = selectionScopeAvailability([makeAnalytics('a'), makeCandlestick('c')])
    expect(result).toEqual({ canChangeQuery: true, canChangeTicker: true })
  })

  test('single analytics card → canChangeQuery true, canChangeTicker false', () => {
    const result = selectionScopeAvailability([makeAnalytics('a')])
    expect(result).toEqual({ canChangeQuery: true, canChangeTicker: false })
  })

  test('single candlestick card → canChangeQuery false, canChangeTicker true', () => {
    const result = selectionScopeAvailability([makeCandlestick('c')])
    expect(result).toEqual({ canChangeQuery: false, canChangeTicker: true })
  })
})

// ── describeIngestResult ────────────────────────────────────────────────────

describe('describeIngestResult', () => {
  test('200 → ok:true with success message', () => {
    const result = describeIngestResult(200, null)
    expect(result.ok).toBe(true)
    expect(result.message).toContain('charts will update shortly')
  })

  test('201 → ok:true with success message', () => {
    const result = describeIngestResult(201, null)
    expect(result.ok).toBe(true)
    expect(result.message).toContain('charts will update shortly')
  })

  test('402 → ok:false with quota exceeded message', () => {
    const result = describeIngestResult(402, null)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Monthly query limit reached')
  })

  test('403 + body.error=byok_required → ok:false with byok message', () => {
    const result = describeIngestResult(403, { error: 'byok_required' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('API key')
    expect(result.message).toContain('Account')
  })

  test('403 without byok_required → ok:false with generic message', () => {
    const result = describeIngestResult(403, { error: 'forbidden' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('403')
  })

  test('500 → ok:false with generic message containing the status', () => {
    const result = describeIngestResult(500, null)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('500')
  })
})

// ── applyScopeToSelectedCards ───────────────────────────────────────────────

describe('applyScopeToSelectedCards', () => {
  const analytics: DashboardCard = {
    id: 'a1',
    type: 'mentions',
    position: { x: 0, y: 0, w: 6, h: 9 },
    options: { query: 'old-query' },
  }
  const candle: DashboardCard = {
    id: 'c1',
    type: 'candlestick',
    position: { x: 0, y: 0, w: 12, h: 12 },
    options: { ticker: 'OLD' },
  }
  const unselected: DashboardCard = {
    id: 'u1',
    type: 'hashtags',
    position: { x: 6, y: 0, w: 6, h: 9 },
    options: { query: 'untouched' },
  }

  test('applies query only to selected analytics cards, skips unselected', () => {
    const result = applyScopeToSelectedCards([analytics, unselected], ['a1'], 'query', 'new-query')
    expect(result[0].options.query).toBe('new-query')
    expect(result[1].options.query).toBe('untouched')
  })

  test('does NOT apply query to candlestick cards (type-gating)', () => {
    const result = applyScopeToSelectedCards([analytics, candle], new Set(['a1', 'c1']), 'query', 'bitcoin')
    expect(result[0].options.query).toBe('bitcoin')
    // candlestick card should be untouched
    expect(result[1].options.query).toBeUndefined()
    expect(result[1].options.ticker).toBe('OLD')
  })

  test('applies ticker only to candlestick cards, skips analytics (type-gating)', () => {
    const result = applyScopeToSelectedCards([analytics, candle], new Set(['a1', 'c1']), 'ticker', 'ETH')
    // analytics card unchanged
    expect(result[0].options.ticker).toBeUndefined()
    expect(result[0].options.query).toBe('old-query')
    // candlestick updated
    expect(result[1].options.ticker).toBe('ETH')
  })

  test('trims whitespace from the value', () => {
    const result = applyScopeToSelectedCards([analytics], ['a1'], 'query', '  bitcoin  ')
    expect(result[0].options.query).toBe('bitcoin')
  })

  test('does not mutate the original cards array', () => {
    const original = [{ ...analytics, options: { ...analytics.options } }]
    applyScopeToSelectedCards(original, ['a1'], 'query', 'new')
    expect(original[0].options.query).toBe('old-query')
  })

  test('does not mutate the original options object of a matched card', () => {
    const original = [{ ...analytics, options: { ...analytics.options } }]
    const optRef = original[0].options
    applyScopeToSelectedCards(original, ['a1'], 'query', 'new')
    expect(optRef.query).toBe('old-query')
  })

  test('preserves other options fields when updating', () => {
    const card: DashboardCard = { id: 'x', type: 'mentions', position: { x: 0, y: 0, w: 6, h: 9 }, options: { query: 'old', threshold: 5 } }
    const result = applyScopeToSelectedCards([card], ['x'], 'query', 'new')
    expect(result[0].options.threshold).toBe(5)
    expect(result[0].options.query).toBe('new')
  })

  test('accepts Set<string> as selectedIds', () => {
    const result = applyScopeToSelectedCards([analytics], new Set(['a1']), 'query', 'set-based')
    expect(result[0].options.query).toBe('set-based')
  })

  test('accepts string[] as selectedIds', () => {
    const result = applyScopeToSelectedCards([analytics], ['a1'], 'query', 'array-based')
    expect(result[0].options.query).toBe('array-based')
  })

  test('returns a new array (not the same reference)', () => {
    const cards = [analytics]
    const result = applyScopeToSelectedCards(cards, [], 'query', 'val')
    expect(result).not.toBe(cards)
  })
})
