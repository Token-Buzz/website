'use client'

import type { DashboardCardType } from '@monorepo-template/core/db/dashboards'
import { TopMentionsChart } from '../../_analytics/TopMentionsChart'
import { SentimentGaugeChart } from '../../_analytics/SentimentGaugeChart'
import { TopHashtagsChart } from '../../_analytics/TopHashtagsChart'
import { DomainDistributionChart } from '../../_analytics/DomainDistributionChart'
import { LanguageDistributionChart } from '../../_analytics/LanguageDistributionChart'
import { SourceDistributionChart } from '../../_analytics/SourceDistributionChart'
import { BioDomainsChart } from '../../_analytics/BioDomainsChart'
import { SymbolRateChart } from '../../_analytics/SymbolRateChart'
import { EngagementTimeSeriesChart } from '../../_analytics/EngagementTimeSeriesChart'
import { SentimentTimelineChart } from '../../_analytics/SentimentTimelineChart'
import { KeywordWordCloudChart } from '../../_analytics/KeywordWordCloudChart'
import { ConversationDepthChart } from '../../_analytics/ConversationDepthChart'
import { GeographicDistributionMapChart } from '../../_analytics/GeographicDistributionMapChart'
import { VerificationBreakdownChart } from '../../_analytics/VerificationBreakdownChart'
import { BotRatioChart } from '../../_analytics/BotRatioChart'
import { PostingHeatmapChart } from '../../_analytics/PostingHeatmapChart'
import { ContentLengthEngagementChart } from '../../_analytics/ContentLengthEngagementChart'
import { AuthorInfluenceScatterChart } from '../../_analytics/AuthorInfluenceScatterChart'
import { CandleChart } from '../../_dashboard/CandleChart'

// ── CARD_META ─────────────────────────────────────────────────────────────────

export const CARD_META: Record<DashboardCardType, { label: string; meta: string }> = {
  mentions:             { label: 'Top mentions',                    meta: 'last 24h · by reach' },
  sentiment:            { label: 'Sentiment gauge',                 meta: 'avg score · 7D' },
  hashtags:             { label: 'Top hashtags',                    meta: 'last 24h' },
  domains:              { label: 'Domain distribution',             meta: 'tweet URLs' },
  languages:            { label: 'Language distribution',           meta: 'tweet language' },
  sources:              { label: 'Source distribution',             meta: 'Twitter client' },
  'top-authors':        { label: 'Top authors',                     meta: 'coming soon' },
  candlestick:          { label: 'Candlestick',                     meta: 'OHLCV · social overlays' },
  'bio-domains':        { label: 'Bio domains',                     meta: 'author bio links' },
  'symbol-rate':        { label: 'Symbol rate',                     meta: 'tweets / hour' },
  engagement:           { label: 'Engagement timeseries',           meta: 'likes · RT · replies · quotes' },
  'sentiment-timeline': { label: 'Sentiment timeline',              meta: '% bull / bear / mixed' },
  keywords:             { label: 'Keyword word cloud',              meta: 'top extracted terms' },
  'conversation-depth': { label: 'Conversation depth',              meta: 'thread reply depth' },
  geo:                  { label: 'Geographic distribution',         meta: 'author locations · top 15' },
  verification:         { label: 'Verification breakdown',          meta: 'blue · business · government' },
  'bot-ratio':          { label: 'Bot ratio',                       meta: 'automated vs human' },
  'posting-heatmap':    { label: 'Posting heatmap',                 meta: 'day × hour · 7D' },
  'content-length':     { label: 'Content length × engagement',     meta: 'text length vs engagement score' },
  'author-influence':   { label: 'Author influence',                meta: 'followers vs engagement rate' },
}

// ── ALL_CARD_TYPES ─────────────────────────────────────────────────────────────

export const ALL_CARD_TYPES: DashboardCardType[] = [
  'hashtags',
  'mentions',
  'domains',
  'bio-domains',
  'symbol-rate',
  'engagement',
  'sentiment',
  'sentiment-timeline',
  'keywords',
  'conversation-depth',
  'geo',
  'languages',
  'sources',
  'verification',
  'bot-ratio',
  'posting-heatmap',
  'content-length',
  'author-influence',
  'top-authors',
  'candlestick',
]

// ── CandleChartCard ───────────────────────────────────────────────────────────

function CandleChartCard({ symbol }: { symbol: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <CandleChart symbol={symbol} interval="1h" height={320} />
    </div>
  )
}

// ── CardBody ──────────────────────────────────────────────────────────────────

interface CardBodyProps {
  type: DashboardCardType
  query: string
  /** When present, used as the candlestick symbol instead of the scope query. */
  ticker?: string
}

const comingSoonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  font: '500 12px var(--font-mono)',
  color: 'var(--fg-4)',
}

export function CardBody({ type, query, ticker }: CardBodyProps) {
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
    case 'bio-domains':
      return <BioDomainsChart query={query} />
    case 'symbol-rate':
      return <SymbolRateChart query={query} />
    case 'engagement':
      return <EngagementTimeSeriesChart query={query} />
    case 'sentiment-timeline':
      return <SentimentTimelineChart query={query} />
    case 'keywords':
      return <KeywordWordCloudChart query={query} />
    case 'conversation-depth':
      return <ConversationDepthChart query={query} />
    case 'geo':
      return <GeographicDistributionMapChart query={query} />
    case 'verification':
      return <VerificationBreakdownChart query={query} />
    case 'bot-ratio':
      return <BotRatioChart query={query} />
    case 'posting-heatmap':
      return <PostingHeatmapChart query={query} />
    case 'content-length':
      return <ContentLengthEngagementChart query={query} />
    case 'author-influence':
      return <AuthorInfluenceScatterChart query={query} />
    case 'top-authors':
      return <div style={comingSoonStyle}>Coming soon</div>
    case 'candlestick':
      return <CandleChartCard symbol={ticker?.trim() || query} />
    default: {
      // TypeScript exhaustiveness — should never happen at runtime
      const _exhaustive: never = type
      return <div style={comingSoonStyle}>Unknown card type: {String(_exhaustive)}</div>
    }
  }
}
