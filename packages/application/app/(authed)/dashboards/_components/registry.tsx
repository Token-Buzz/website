'use client'

import type { DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { TopMentionsChart } from '../../_analytics/TopMentionsChart'
import { SentimentGaugeChart } from '../../_analytics/SentimentGaugeChart'
import { TopHashtagsChart } from '../../_analytics/TopHashtagsChart'
import { DomainDistributionChart } from '../../_analytics/DomainDistributionChart'
import { LanguageDistributionChart } from '../../_analytics/LanguageDistributionChart'
import { SourceDistributionChart } from '../../_analytics/SourceDistributionChart'

// ── CARD_META ─────────────────────────────────────────────────────────────────

export const CARD_META: Record<DashboardCardType, { label: string; meta: string }> = {
  mentions:     { label: 'Top mentions',         meta: 'last 24h · by reach' },
  sentiment:    { label: 'Sentiment gauge',      meta: 'avg score · 7D' },
  hashtags:     { label: 'Top hashtags',         meta: 'last 24h' },
  domains:      { label: 'Domain distribution',  meta: 'tweet URLs' },
  languages:    { label: 'Language distribution',meta: 'tweet language' },
  sources:      { label: 'Source distribution',  meta: 'Twitter client' },
  'top-authors':{ label: 'Top authors',          meta: 'coming soon' },
  candlestick:  { label: 'Candlestick',          meta: 'coming soon' },
}

// ── ALL_CARD_TYPES ─────────────────────────────────────────────────────────────

export const ALL_CARD_TYPES: DashboardCardType[] = [
  'mentions',
  'sentiment',
  'hashtags',
  'domains',
  'languages',
  'sources',
  'top-authors',
  'candlestick',
]

// ── CardBody ──────────────────────────────────────────────────────────────────

interface CardBodyProps {
  type: DashboardCardType
  query: string
}

const comingSoonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  font: '500 12px var(--font-mono)',
  color: 'var(--fg-4)',
}

export function CardBody({ type, query }: CardBodyProps) {
  switch (type) {
    case 'mentions':
      return <TopMentionsChart query={query} />
    case 'sentiment':
      return <SentimentGaugeChart query={query} />
    case 'hashtags':
      return <TopHashtagsChart query={query} />
    case 'domains':
      return <DomainDistributionChart query={query} />
    case 'languages':
      return <LanguageDistributionChart query={query} />
    case 'sources':
      return <SourceDistributionChart query={query} />
    case 'top-authors':
    case 'candlestick':
      return <div style={comingSoonStyle}>Coming soon</div>
    default: {
      // TypeScript exhaustiveness — should never happen at runtime
      const _exhaustive: never = type
      return <div style={comingSoonStyle}>Unknown card type: {String(_exhaustive)}</div>
    }
  }
}
