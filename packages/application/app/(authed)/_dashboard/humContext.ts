// Shared contract for the Hum drag-in context system.
// Pure module — no browser APIs at import time, all browser usage is guarded.

// ── Constants ──────────────────────────────────────────────────────────────

export const HUM_CONTEXT_MIME = 'application/x-hum-context'
export const HUM_OPEN_EVENT = 'hum:open'

// ── Canonical staged item ──────────────────────────────────────────────────

export interface HumStagedContext {
  id: string      // stable dedupe key
  type: string    // satisfies DB HumContextItem.type
  label: string   // short chip text shown in UI
  summary: string // one-line description sent to the model
}

// ── Mapper: dashboard / analytics card ────────────────────────────────────

export function fromCard(c: {
  cardType: string
  label: string
  query: string
  ticker?: string
}): HumStagedContext {
  const ticker = c.ticker?.trim()
  return {
    id: `card:${c.cardType}:${c.query}:${ticker ?? ''}`,
    type: 'dashboard-card',
    label: ticker ? `${c.label} · ${ticker}` : c.label,
    summary: `Dashboard "${c.label}" card${ticker ? ` for $${ticker}` : ''} (query: "${c.query}")`,
  }
}

// ── Mapper: tweet ──────────────────────────────────────────────────────────

export function fromTweet(t: {
  handle: string
  text: string
  tick?: string
}): HumStagedContext {
  const tick = t.tick?.trim()
  return {
    id: `tweet:${t.handle}:${t.text.slice(0, 25)}`,
    type: 'tweet',
    label: tick ? `$${tick} · ${t.handle}` : t.handle,
    summary: `Tweet from ${t.handle}${tick ? ` about $${tick}` : ''}: "${t.text}"`,
  }
}

// ── Mapper: token ──────────────────────────────────────────────────────────

export function fromToken(t: {
  sym: string
  name?: string
  mentions?: number
  dbuzz?: number
  sent?: string
}): HumStagedContext {
  let summary = `Token $${t.sym}`
  if (t.name) summary += ` (${t.name})`
  if (t.mentions != null) summary += `, ${t.mentions} mentions`
  if (t.dbuzz != null) summary += `, Δbuzz ${t.dbuzz}`
  if (t.sent) summary += `, sentiment ${t.sent}`

  return {
    id: `token:${t.sym}`,
    type: 'token',
    label: `$${t.sym}`,
    summary,
  }
}

// ── Mapper: narrative ──────────────────────────────────────────────────────

export function fromNarrative(n: {
  title: string
  tokens?: string[]
}): HumStagedContext {
  return {
    id: `narrative:${n.title}`,
    type: 'narrative',
    label: n.title,
    summary: `Narrative "${n.title}"${n.tokens?.length ? ` (tokens: ${n.tokens.join(', ')})` : ''}`,
  }
}

// ── Mapper: chart ──────────────────────────────────────────────────────────

export function fromChart(c: {
  symbol: string
  interval: string
  livePrice?: number | null
}): HumStagedContext {
  const parts: string[] = [`$${c.symbol} ${c.interval} chart`]
  if (c.livePrice != null) parts.push(`live price $${c.livePrice.toFixed(6)}`)
  return {
    id: `chart:${c.symbol}:${c.interval}`,
    type: 'chart',
    label: `$${c.symbol} chart`,
    summary: parts.join(', '),
  }
}

// ── Serialization ──────────────────────────────────────────────────────────

export function serializeContext(item: HumStagedContext): string {
  return JSON.stringify(item)
}

export function parseContext(raw: string): HumStagedContext | null {
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof parsed.id !== 'string' ||
      typeof parsed.type !== 'string' ||
      typeof parsed.label !== 'string' ||
      typeof parsed.summary !== 'string'
    ) return null
    return parsed as HumStagedContext
  } catch {
    return null
  }
}

// ── Adapter: existing click path (hum:add-context event detail) ────────────

export function fromCardEvent(detail: unknown): HumStagedContext | null {
  if (detail === null || typeof detail !== 'object') return null
  const d = detail as Record<string, unknown>
  if (
    typeof d.cardType !== 'string' ||
    typeof d.label !== 'string' ||
    typeof d.query !== 'string'
  ) return null
  const ticker = typeof d.ticker === 'string' ? d.ticker : undefined
  return fromCard({ cardType: d.cardType, label: d.label, query: d.query, ticker })
}
