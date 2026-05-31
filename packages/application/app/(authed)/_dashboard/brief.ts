/**
 * Pure helper functions for the Hum morning brief feature.
 * No React, no browser APIs — fully unit-testable.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface BriefSignals {
  kpis: { mentions24h: number; tokenCount: number; netSentiment: number; alertCount: number }
  spikes: { symbol: string; deltaScore: number; mentions: number; sentiment: string }[]
  sentimentGrid: { sym: string; score: number; mentions: number; d: number }[]
  narratives: { title: string; growth: number; tokens: string[]; mentions: number }[]
}

export interface BriefResult {
  brief: string
  quickAsks: string[]
}

// ── buildBriefPrompt ───────────────────────────────────────────────────────

/**
 * Turns BriefSignals into a compact, readable text block of today's facts
 * for inclusion as the user message to the brief API.
 */
export function buildBriefPrompt(signals: BriefSignals): string {
  const lines: string[] = []

  // KPI summary
  lines.push('=== Today\'s snapshot ===')
  lines.push(`Mentions (24h): ${signals.kpis.mentions24h}`)
  lines.push(`Tokens tracked: ${signals.kpis.tokenCount}`)
  const sentStr = signals.kpis.netSentiment >= 0
    ? `+${signals.kpis.netSentiment}`
    : `${signals.kpis.netSentiment}`
  lines.push(`Net sentiment: ${sentStr}`)
  lines.push(`Alerts fired today: ${signals.kpis.alertCount}`)

  // Top spikes
  lines.push('')
  lines.push('=== Biggest buzz spikes (last hour) ===')
  if (signals.spikes.length === 0) {
    lines.push('No spikes')
  } else {
    for (const s of signals.spikes.slice(0, 5)) {
      const delta = s.deltaScore >= 0 ? `+${s.deltaScore}%` : `${s.deltaScore}%`
      lines.push(`$${s.symbol}: ${delta} Δbuzz, ${s.mentions} mentions, sentiment=${s.sentiment}`)
    }
  }

  // Sentiment grid — most bullish / most bearish
  lines.push('')
  lines.push('=== Sentiment grid (watchlist tokens, 24h) ===')
  if (signals.sentimentGrid.length === 0) {
    lines.push('No sentiment data')
  } else {
    const sorted = [...signals.sentimentGrid].sort((a, b) => b.score - a.score)
    const bullish = sorted.slice(0, 3).filter((t) => t.score > 0)
    const bearish = sorted.slice().reverse().slice(0, 3).filter((t) => t.score < 0)
    if (bullish.length > 0) {
      lines.push(
        'Most bullish: ' +
          bullish.map((t) => `$${t.sym} (score +${t.score}, ${t.mentions} mentions)`).join(', '),
      )
    }
    if (bearish.length > 0) {
      lines.push(
        'Most bearish: ' +
          bearish.map((t) => `$${t.sym} (score ${t.score}, ${t.mentions} mentions)`).join(', '),
      )
    }
    if (bullish.length === 0 && bearish.length === 0) {
      lines.push('All tokens at neutral sentiment')
    }
  }

  // Top narratives
  lines.push('')
  lines.push('=== Emerging narratives (24h) ===')
  if (signals.narratives.length === 0) {
    lines.push('No narratives detected')
  } else {
    for (const n of signals.narratives.slice(0, 4)) {
      const growth = n.growth >= 0 ? `+${n.growth}%` : `${n.growth}%`
      const toks = n.tokens.length > 0 ? ` (tokens: ${n.tokens.slice(0, 4).join(', ')})` : ''
      lines.push(`"${n.title}": ${growth} growth, ${n.mentions} mentions${toks}`)
    }
  }

  return lines.join('\n')
}

// ── parseBriefResponse ─────────────────────────────────────────────────────

/**
 * Robustly extracts { brief, quickAsks } from model output.
 * Handles: clean JSON, JSON inside ```json fences, surrounding prose.
 * On any parse failure falls back to { brief: text.trim(), quickAsks: [] }.
 * quickAsks is clamped to max 3 non-empty strings.
 */
export function parseBriefResponse(text: string): BriefResult {
  function clamp(arr: unknown[]): string[] {
    return arr
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, 3)
  }

  function tryParse(raw: string): BriefResult | null {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        typeof (parsed as Record<string, unknown>).brief !== 'string'
      ) {
        return null
      }
      const obj = parsed as Record<string, unknown>
      const brief = (obj.brief as string).trim()
      const quickAsks = Array.isArray(obj.quickAsks) ? clamp(obj.quickAsks) : []
      return { brief, quickAsks }
    } catch {
      return null
    }
  }

  // 1. Try direct JSON parse first
  const direct = tryParse(text.trim())
  if (direct) return direct

  // 2. Try to extract from ```json ... ``` fences
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (fenceMatch?.[1]) {
    const fenced = tryParse(fenceMatch[1].trim())
    if (fenced) return fenced
  }

  // 3. Try any ``` ... ``` fence (without language tag)
  const rawFenceMatch = text.match(/```\s*([\s\S]*?)```/)
  if (rawFenceMatch?.[1]) {
    const rawFenced = tryParse(rawFenceMatch[1].trim())
    if (rawFenced) return rawFenced
  }

  // 4. Try to find a JSON object anywhere in the prose (first { to last })
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = tryParse(text.slice(firstBrace, lastBrace + 1))
    if (extracted) return extracted
  }

  // 5. Fallback: return raw text as the brief
  return { brief: text.trim(), quickAsks: [] }
}
