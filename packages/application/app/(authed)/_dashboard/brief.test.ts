import { describe, test, expect } from 'vitest'
import { buildBriefPrompt, parseBriefResponse, type BriefSignals } from './brief'

// ── buildBriefPrompt ────────────────────────────────────────────────────────

const EMPTY_SIGNALS: BriefSignals = {
  kpis: { mentions24h: 0, tokenCount: 0, netSentiment: 0, alertCount: 0 },
  spikes: [],
  sentimentGrid: [],
  narratives: [],
}

const FULL_SIGNALS: BriefSignals = {
  kpis: { mentions24h: 42000, tokenCount: 12, netSentiment: 15, alertCount: 3 },
  spikes: [
    { symbol: 'PEPE', deltaScore: 412, mentions: 49000, sentiment: 'bull' },
    { symbol: 'MOG', deltaScore: -18, mentions: 3200, sentiment: 'bear' },
  ],
  sentimentGrid: [
    { sym: 'BTC', score: 60, mentions: 5000, d: 5 },
    { sym: 'ETH', score: -30, mentions: 2000, d: -3 },
    { sym: 'DOGE', score: 0, mentions: 800, d: 0 },
  ],
  narratives: [
    { title: 'Layer 2 boom', growth: 88, tokens: ['ARB', 'OP'], mentions: 12000 },
    { title: 'DeFi re-rating', growth: -5, tokens: ['AAVE', 'UNI'], mentions: 4000 },
  ],
}

describe('buildBriefPrompt', () => {
  test('includes KPI values in output', () => {
    const prompt = buildBriefPrompt(FULL_SIGNALS)
    expect(prompt).toContain('42000')
    expect(prompt).toContain('12')
    expect(prompt).toContain('+15')
    expect(prompt).toContain('3')
  })

  test('formats negative net sentiment without extra plus', () => {
    const sig: BriefSignals = { ...EMPTY_SIGNALS, kpis: { ...EMPTY_SIGNALS.kpis, netSentiment: -10 } }
    const prompt = buildBriefPrompt(sig)
    expect(prompt).toContain('-10')
    expect(prompt).not.toContain('+-10')
  })

  test('includes spike symbols and delta percentages', () => {
    const prompt = buildBriefPrompt(FULL_SIGNALS)
    expect(prompt).toContain('$PEPE')
    expect(prompt).toContain('+412%')
    expect(prompt).toContain('$MOG')
    expect(prompt).toContain('-18%')
  })

  test('shows "No spikes" when spikes array is empty', () => {
    const prompt = buildBriefPrompt(EMPTY_SIGNALS)
    expect(prompt).toContain('No spikes')
  })

  test('limits spikes to first 5', () => {
    const manySpikes = Array.from({ length: 10 }, (_, i) => ({
      symbol: `TOK${i}`,
      deltaScore: i * 10,
      mentions: 100,
      sentiment: 'neu',
    }))
    const sig: BriefSignals = { ...FULL_SIGNALS, spikes: manySpikes }
    const prompt = buildBriefPrompt(sig)
    // TOK5 and beyond should NOT appear (0-indexed: TOK0..TOK4 are first 5)
    expect(prompt).not.toContain('$TOK5')
    expect(prompt).toContain('$TOK4')
  })

  test('shows most bullish and most bearish tokens from sentiment grid', () => {
    const prompt = buildBriefPrompt(FULL_SIGNALS)
    expect(prompt).toContain('$BTC')   // most bullish (score +60)
    expect(prompt).toContain('$ETH')   // most bearish (score -30)
  })

  test('shows "No sentiment data" when sentimentGrid is empty', () => {
    const prompt = buildBriefPrompt(EMPTY_SIGNALS)
    expect(prompt).toContain('No sentiment data')
  })

  test('shows "All tokens at neutral sentiment" when all scores are 0', () => {
    const sig: BriefSignals = {
      ...EMPTY_SIGNALS,
      sentimentGrid: [
        { sym: 'BTC', score: 0, mentions: 1000, d: 0 },
        { sym: 'ETH', score: 0, mentions: 500, d: 0 },
      ],
    }
    const prompt = buildBriefPrompt(sig)
    expect(prompt).toContain('All tokens at neutral sentiment')
  })

  test('includes narrative titles and growth percentages', () => {
    const prompt = buildBriefPrompt(FULL_SIGNALS)
    expect(prompt).toContain('Layer 2 boom')
    expect(prompt).toContain('+88%')
    expect(prompt).toContain('DeFi re-rating')
    expect(prompt).toContain('-5%')
  })

  test('shows "No narratives detected" when narratives array is empty', () => {
    const prompt = buildBriefPrompt(EMPTY_SIGNALS)
    expect(prompt).toContain('No narratives detected')
  })

  test('limits narratives to first 4', () => {
    const manyNarratives = Array.from({ length: 8 }, (_, i) => ({
      title: `Narrative ${i}`,
      growth: i,
      tokens: [],
      mentions: 100,
    }))
    const sig: BriefSignals = { ...FULL_SIGNALS, narratives: manyNarratives }
    const prompt = buildBriefPrompt(sig)
    expect(prompt).toContain('Narrative 3')
    expect(prompt).not.toContain('Narrative 4')
  })

  test('produces a non-empty string for empty signals', () => {
    const prompt = buildBriefPrompt(EMPTY_SIGNALS)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})

// ── parseBriefResponse ──────────────────────────────────────────────────────

describe('parseBriefResponse', () => {
  test('parses clean JSON with brief and quickAsks', () => {
    const json = JSON.stringify({ brief: 'Hello world.', quickAsks: ['Q1?', 'Q2?'] })
    const result = parseBriefResponse(json)
    expect(result.brief).toBe('Hello world.')
    expect(result.quickAsks).toEqual(['Q1?', 'Q2?'])
  })

  test('parses JSON inside ```json fences', () => {
    const text = '```json\n{"brief":"From fence.","quickAsks":["A?"]}\n```'
    const result = parseBriefResponse(text)
    expect(result.brief).toBe('From fence.')
    expect(result.quickAsks).toEqual(['A?'])
  })

  test('parses JSON inside plain ``` fences (no language tag)', () => {
    const text = '```\n{"brief":"Plain fence.","quickAsks":[]}\n```'
    const result = parseBriefResponse(text)
    expect(result.brief).toBe('Plain fence.')
    expect(result.quickAsks).toEqual([])
  })

  test('parses JSON embedded in surrounding prose', () => {
    const text = 'Here is the brief: {"brief":"Embedded.","quickAsks":["Follow up?"]} — end.'
    const result = parseBriefResponse(text)
    expect(result.brief).toBe('Embedded.')
    expect(result.quickAsks).toEqual(['Follow up?'])
  })

  test('falls back to raw text on garbage input', () => {
    const garbage = 'This is just some random text with no JSON at all.'
    const result = parseBriefResponse(garbage)
    expect(result.brief).toBe(garbage)
    expect(result.quickAsks).toEqual([])
  })

  test('falls back on malformed JSON', () => {
    const bad = '{ brief: "not valid json" }'
    const result = parseBriefResponse(bad)
    expect(result.brief).toBe(bad)
    expect(result.quickAsks).toEqual([])
  })

  test('clamps quickAsks to max 3', () => {
    const json = JSON.stringify({
      brief: 'Short brief.',
      quickAsks: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
    })
    const result = parseBriefResponse(json)
    expect(result.quickAsks).toHaveLength(3)
    expect(result.quickAsks).toEqual(['Q1?', 'Q2?', 'Q3?'])
  })

  test('drops empty and whitespace-only quickAsks', () => {
    const json = JSON.stringify({
      brief: 'Brief.',
      quickAsks: ['Valid?', '', '   ', 'Also valid?'],
    })
    const result = parseBriefResponse(json)
    expect(result.quickAsks).toEqual(['Valid?', 'Also valid?'])
  })

  test('filters out non-string quickAsks', () => {
    const json = JSON.stringify({
      brief: 'Brief.',
      quickAsks: ['Good?', 42, null, true, 'Also good?'],
    })
    const result = parseBriefResponse(json)
    expect(result.quickAsks).toEqual(['Good?', 'Also good?'])
  })

  test('returns empty quickAsks when field is missing from JSON', () => {
    const json = JSON.stringify({ brief: 'No quickAsks field.' })
    const result = parseBriefResponse(json)
    expect(result.brief).toBe('No quickAsks field.')
    expect(result.quickAsks).toEqual([])
  })

  test('trims whitespace from brief in JSON', () => {
    const json = JSON.stringify({ brief: '  Trimmed.  ', quickAsks: [] })
    const result = parseBriefResponse(json)
    expect(result.brief).toBe('Trimmed.')
  })

  test('trims whitespace from raw fallback text', () => {
    const result = parseBriefResponse('  some text  ')
    expect(result.brief).toBe('some text')
  })

  test('handles empty string input', () => {
    const result = parseBriefResponse('')
    expect(result.brief).toBe('')
    expect(result.quickAsks).toEqual([])
  })
})
