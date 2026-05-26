import { describe, test, expect } from 'vitest'
import { buildHumContextItem, copyCardForDashboard } from './cardActions'
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
