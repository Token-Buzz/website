import { describe, test, expect } from 'vitest'
import { buildHumContextItem, copyCardForDashboard, buildQueryDashboardCards, buildInitialDashboardCards, ANALYTICS_CARD_TYPES } from './cardActions'
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
