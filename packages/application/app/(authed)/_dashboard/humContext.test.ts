import { describe, test, expect } from 'vitest'
import {
  fromCard,
  fromTweet,
  fromToken,
  fromNarrative,
  serializeContext,
  parseContext,
  fromCardEvent,
} from './humContext'

// ── fromCard ───────────────────────────────────────────────────────────────

describe('fromCard', () => {
  test('id includes cardType, query, and ticker', () => {
    const item = fromCard({ cardType: 'mentions', label: 'BTC Mentions', query: 'bitcoin', ticker: 'BTC' })
    expect(item.id).toBe('card:mentions:bitcoin:BTC')
  })

  test('id ends with empty string when no ticker', () => {
    const item = fromCard({ cardType: 'sentiment', label: 'General', query: 'crypto' })
    expect(item.id).toBe('card:sentiment:crypto:')
  })

  test('label includes ticker when present', () => {
    const item = fromCard({ cardType: 'mentions', label: 'BTC Mentions', query: 'bitcoin', ticker: 'BTC' })
    expect(item.label).toBe('BTC Mentions · BTC')
  })

  test('label is just the card label when no ticker', () => {
    const item = fromCard({ cardType: 'mentions', label: 'General', query: 'crypto' })
    expect(item.label).toBe('General')
  })

  test('summary mentions ticker with $ prefix', () => {
    const item = fromCard({ cardType: 'mentions', label: 'BTC Mentions', query: 'bitcoin', ticker: 'BTC' })
    expect(item.summary).toContain('$BTC')
    expect(item.summary).toContain('"bitcoin"')
  })

  test('summary without ticker', () => {
    const item = fromCard({ cardType: 'sentiment', label: 'Sentiment', query: 'crypto' })
    expect(item.summary).toBe('Dashboard "Sentiment" card (query: "crypto")')
  })

  test('type is dashboard-card', () => {
    const item = fromCard({ cardType: 'mentions', label: 'L', query: 'q' })
    expect(item.type).toBe('dashboard-card')
  })
})

// ── fromTweet ──────────────────────────────────────────────────────────────

describe('fromTweet', () => {
  test('id is tweet:handle:first24chars', () => {
    const item = fromTweet({ handle: 'alice', text: 'Hello world this is a long tweet', tick: 'SOL' })
    expect(item.id).toBe('tweet:alice:Hello world this is a lon')
  })

  test('label includes tick and handle', () => {
    const item = fromTweet({ handle: 'alice', text: 'Hi', tick: 'SOL' })
    expect(item.label).toBe('$SOL · alice')
  })

  test('label is just handle when no tick', () => {
    const item = fromTweet({ handle: 'alice', text: 'Hi' })
    expect(item.label).toBe('alice')
  })

  test('summary includes handle, tick, and text', () => {
    const item = fromTweet({ handle: 'alice', text: 'SOL to the moon', tick: 'SOL' })
    expect(item.summary).toContain('alice')
    expect(item.summary).toContain('$SOL')
    expect(item.summary).toContain('SOL to the moon')
  })

  test('summary without tick', () => {
    const item = fromTweet({ handle: 'bob', text: 'Just a tweet' })
    expect(item.summary).toBe('Tweet from bob: "Just a tweet"')
  })

  test('type is tweet', () => {
    const item = fromTweet({ handle: 'x', text: 'y' })
    expect(item.type).toBe('tweet')
  })
})

// ── fromToken ──────────────────────────────────────────────────────────────

describe('fromToken', () => {
  test('id is token:sym', () => {
    const item = fromToken({ sym: 'PEPE' })
    expect(item.id).toBe('token:PEPE')
  })

  test('label is $sym', () => {
    const item = fromToken({ sym: 'PEPE' })
    expect(item.label).toBe('$PEPE')
  })

  test('summary includes name, mentions, dbuzz, sentiment', () => {
    const item = fromToken({ sym: 'PEPE', name: 'Pepe Coin', mentions: 1234, dbuzz: 5.2, sent: 'bull' })
    expect(item.summary).toContain('(Pepe Coin)')
    expect(item.summary).toContain('1234 mentions')
    expect(item.summary).toContain('Δbuzz 5.2')
    expect(item.summary).toContain('sentiment bull')
  })

  test('summary with only sym', () => {
    const item = fromToken({ sym: 'SOL' })
    expect(item.summary).toBe('Token $SOL')
  })

  test('type is token', () => {
    const item = fromToken({ sym: 'X' })
    expect(item.type).toBe('token')
  })
})

// ── fromNarrative ──────────────────────────────────────────────────────────

describe('fromNarrative', () => {
  test('id is narrative:title', () => {
    const item = fromNarrative({ title: 'AI agents' })
    expect(item.id).toBe('narrative:AI agents')
  })

  test('label is the title', () => {
    const item = fromNarrative({ title: 'AI agents' })
    expect(item.label).toBe('AI agents')
  })

  test('summary includes tokens when present', () => {
    const item = fromNarrative({ title: 'AI agents', tokens: ['TAO', 'AGIX'] })
    expect(item.summary).toContain('TAO, AGIX')
  })

  test('summary without tokens', () => {
    const item = fromNarrative({ title: 'DeFi' })
    expect(item.summary).toBe('Narrative "DeFi"')
  })

  test('type is narrative', () => {
    const item = fromNarrative({ title: 'x' })
    expect(item.type).toBe('narrative')
  })
})

// ── serialize / parse round-trip ───────────────────────────────────────────

describe('serializeContext + parseContext', () => {
  test('round-trip returns the original item', () => {
    const item = fromCard({ cardType: 'mentions', label: 'BTC', query: 'bitcoin', ticker: 'BTC' })
    expect(parseContext(serializeContext(item))).toEqual(item)
  })

  test('parseContext returns null for non-JSON', () => {
    expect(parseContext('not json')).toBeNull()
  })

  test('parseContext returns null for missing id', () => {
    expect(parseContext(JSON.stringify({ type: 'token', label: 'L', summary: 'S' }))).toBeNull()
  })

  test('parseContext returns null for missing type', () => {
    expect(parseContext(JSON.stringify({ id: 'x', label: 'L', summary: 'S' }))).toBeNull()
  })

  test('parseContext returns null for missing label', () => {
    expect(parseContext(JSON.stringify({ id: 'x', type: 't', summary: 'S' }))).toBeNull()
  })

  test('parseContext returns null for missing summary', () => {
    expect(parseContext(JSON.stringify({ id: 'x', type: 't', label: 'L' }))).toBeNull()
  })

  test('parseContext returns null when id is not a string', () => {
    expect(parseContext(JSON.stringify({ id: 42, type: 't', label: 'L', summary: 'S' }))).toBeNull()
  })

  test('parseContext returns null for a JSON array', () => {
    expect(parseContext(JSON.stringify([]))).toBeNull()
  })

  test('parseContext returns null for JSON null', () => {
    expect(parseContext('null')).toBeNull()
  })
})

// ── fromCardEvent ──────────────────────────────────────────────────────────

describe('fromCardEvent', () => {
  test('valid card detail returns HumStagedContext', () => {
    const detail = { cardType: 'mentions', label: 'BTC Mentions', query: 'bitcoin', ticker: 'BTC' }
    const item = fromCardEvent(detail)
    expect(item).not.toBeNull()
    expect(item?.type).toBe('dashboard-card')
    expect(item?.label).toBe('BTC Mentions · BTC')
  })

  test('valid detail without ticker', () => {
    const detail = { cardType: 'sentiment', label: 'General', query: 'crypto' }
    const item = fromCardEvent(detail)
    expect(item).not.toBeNull()
    expect(item?.label).toBe('General')
  })

  test('returns null for null detail', () => {
    expect(fromCardEvent(null)).toBeNull()
  })

  test('returns null for non-object detail', () => {
    expect(fromCardEvent('string')).toBeNull()
    expect(fromCardEvent(42)).toBeNull()
  })

  test('returns null when cardType is missing', () => {
    expect(fromCardEvent({ label: 'L', query: 'q' })).toBeNull()
  })

  test('returns null when label is missing', () => {
    expect(fromCardEvent({ cardType: 'mentions', query: 'q' })).toBeNull()
  })

  test('returns null when query is missing', () => {
    expect(fromCardEvent({ cardType: 'mentions', label: 'L' })).toBeNull()
  })

  test('extra fields from source (source, etc.) do not cause rejection', () => {
    const detail = { cardType: 'mentions', label: 'L', query: 'q', source: 'dashboard-card', ticker: 'X' }
    expect(fromCardEvent(detail)).not.toBeNull()
  })
})
