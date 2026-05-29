"use client";

import { Card, SectionHead } from "../_dashboard/primitives";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { AnalyticsCardFrame } from "./AnalyticsCardFrame";
import { TopHashtagsChart } from "./TopHashtagsChart";
import { TopMentionsChart } from "./TopMentionsChart";
import { DomainDistributionChart } from "./DomainDistributionChart";
import { BioDomainsChart } from "./BioDomainsChart";
import { LanguageDistributionChart } from "./LanguageDistributionChart";
import { SourceDistributionChart } from "./SourceDistributionChart";
import { TweetsResultsTable } from "./TweetsResultsTable";
import { SymbolRateChart } from "./SymbolRateChart";
import { EngagementTimeSeriesChart } from "./EngagementTimeSeriesChart";
import { SentimentTimelineChart } from "./SentimentTimelineChart";
import { ConversationDepthChart } from "./ConversationDepthChart";
import { VerificationBreakdownChart } from "./VerificationBreakdownChart";
import { BotRatioChart } from "./BotRatioChart";
import { KeywordWordCloudChart } from "./KeywordWordCloudChart";
import { AuthorInfluenceScatterChart } from "./AuthorInfluenceScatterChart";
import { SentimentGaugeChart } from "./SentimentGaugeChart";
import { PostingHeatmapChart } from "./PostingHeatmapChart";
import { GeographicDistributionMapChart } from "./GeographicDistributionMapChart";
import { ContentLengthEngagementChart } from "./ContentLengthEngagementChart";
import { fromCard } from "../_dashboard/humContext";
import type { DashboardCardType } from "@monorepo-template/core/db/dashboards";
import type { SocialSource } from "@monorepo-template/core/sources/types";

// ── AnalyticsChartGrid ────────────────────────────────────────────────────────
// Renders the full chart grid + tweet results section.
// Data is read from SummaryContext (either SummaryProvider or StaticSummaryProvider).

interface AnalyticsChartGridProps {
  query: string;
  isMobile: boolean;
  selectedSource: SocialSource | "all";
  onAddToContext: (cardType: DashboardCardType, label: string) => void;
  onAddToDashboard: (cardType: DashboardCardType) => void;
}

export function AnalyticsChartGrid({
  query,
  isMobile,
  selectedSource,
  onAddToContext,
  onAddToDashboard,
}: AnalyticsChartGridProps) {
  return (
    <>
      {/* ── Tweet results ─────────────────────────────────────────────── */}
      {query && (
        <Card padding={20}>
          <SectionHead eyebrow="Tweet results" meta={`query: ${query}`} />
          <ChartErrorBoundary chartName="Tweet results">
            <TweetsResultsTable query={query} selectedSource={selectedSource} />
          </ChartErrorBoundary>
        </Card>
      )}

      {/* ── Chart grid ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 12 : 16,
        }}
      >
        {/* Row 1 */}
        <AnalyticsCardFrame
          label="Top hashtags"
          meta="last 24h"
          onAddToContext={() => onAddToContext("hashtags", "Top hashtags")}
          onAddToDashboard={() => onAddToDashboard("hashtags")}
          dragItem={fromCard({ cardType: "hashtags", label: "Top hashtags", query })}
        >
          <TopHashtagsChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Top mentions"
          meta="last 24h · by reach"
          onAddToContext={() => onAddToContext("mentions", "Top mentions")}
          onAddToDashboard={() => onAddToDashboard("mentions")}
          dragItem={fromCard({ cardType: "mentions", label: "Top mentions", query })}
        >
          <TopMentionsChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 2 */}
        <AnalyticsCardFrame
          label="Domain distribution"
          meta="tweet URLs"
          onAddToContext={() => onAddToContext("domains", "Domain distribution")}
          onAddToDashboard={() => onAddToDashboard("domains")}
          dragItem={fromCard({ cardType: "domains", label: "Domain distribution", query })}
        >
          <DomainDistributionChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Bio domains"
          meta="author bio links"
          onAddToContext={() => onAddToContext("bio-domains", "Bio domains")}
          onAddToDashboard={() => onAddToDashboard("bio-domains")}
          dragItem={fromCard({ cardType: "bio-domains", label: "Bio domains", query })}
        >
          <BioDomainsChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 3 */}
        <AnalyticsCardFrame
          label="Symbol rate"
          meta="tweets / hour"
          onAddToContext={() => onAddToContext("symbol-rate", "Symbol rate")}
          onAddToDashboard={() => onAddToDashboard("symbol-rate")}
          dragItem={fromCard({ cardType: "symbol-rate", label: "Symbol rate", query })}
        >
          <SymbolRateChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Engagement timeseries"
          meta="likes · RT · replies · quotes"
          onAddToContext={() => onAddToContext("engagement", "Engagement timeseries")}
          onAddToDashboard={() => onAddToDashboard("engagement")}
          dragItem={fromCard({ cardType: "engagement", label: "Engagement timeseries", query })}
        >
          <EngagementTimeSeriesChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 4 — sentiment */}
        <AnalyticsCardFrame
          label="Sentiment gauge"
          meta="avg score · 7D"
          onAddToContext={() => onAddToContext("sentiment", "Sentiment gauge")}
          onAddToDashboard={() => onAddToDashboard("sentiment")}
          dragItem={fromCard({ cardType: "sentiment", label: "Sentiment gauge", query })}
        >
          <SentimentGaugeChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Sentiment timeline"
          meta="% bull / bear / mixed"
          onAddToContext={() => onAddToContext("sentiment-timeline", "Sentiment timeline")}
          onAddToDashboard={() => onAddToDashboard("sentiment-timeline")}
          dragItem={fromCard({ cardType: "sentiment-timeline", label: "Sentiment timeline", query })}
        >
          <SentimentTimelineChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 5 */}
        <AnalyticsCardFrame
          label="Keyword word cloud"
          meta="top extracted terms"
          onAddToContext={() => onAddToContext("keywords", "Keyword word cloud")}
          onAddToDashboard={() => onAddToDashboard("keywords")}
          dragItem={fromCard({ cardType: "keywords", label: "Keyword word cloud", query })}
        >
          <KeywordWordCloudChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Conversation depth"
          meta="thread reply depth"
          onAddToContext={() => onAddToContext("conversation-depth", "Conversation depth")}
          onAddToDashboard={() => onAddToDashboard("conversation-depth")}
          dragItem={fromCard({ cardType: "conversation-depth", label: "Conversation depth", query })}
        >
          <ConversationDepthChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 6 */}
        <AnalyticsCardFrame
          label="Geographic distribution"
          meta="author locations · top 15"
          onAddToContext={() => onAddToContext("geo", "Geographic distribution")}
          onAddToDashboard={() => onAddToDashboard("geo")}
          dragItem={fromCard({ cardType: "geo", label: "Geographic distribution", query })}
        >
          <GeographicDistributionMapChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Language distribution"
          meta="tweet language"
          onAddToContext={() => onAddToContext("languages", "Language distribution")}
          onAddToDashboard={() => onAddToDashboard("languages")}
          dragItem={fromCard({ cardType: "languages", label: "Language distribution", query })}
        >
          <LanguageDistributionChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 7 */}
        <AnalyticsCardFrame
          label="Source distribution"
          meta="Twitter client"
          onAddToContext={() => onAddToContext("sources", "Source distribution")}
          onAddToDashboard={() => onAddToDashboard("sources")}
          dragItem={fromCard({ cardType: "sources", label: "Source distribution", query })}
        >
          <SourceDistributionChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Verification breakdown"
          meta="blue · business · government"
          onAddToContext={() => onAddToContext("verification", "Verification breakdown")}
          onAddToDashboard={() => onAddToDashboard("verification")}
          dragItem={fromCard({ cardType: "verification", label: "Verification breakdown", query })}
        >
          <VerificationBreakdownChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 8 */}
        <AnalyticsCardFrame
          label="Bot ratio"
          meta="automated vs human"
          onAddToContext={() => onAddToContext("bot-ratio", "Bot ratio")}
          onAddToDashboard={() => onAddToDashboard("bot-ratio")}
          dragItem={fromCard({ cardType: "bot-ratio", label: "Bot ratio", query })}
        >
          <BotRatioChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Posting heatmap"
          meta="day × hour · 7D"
          onAddToContext={() => onAddToContext("posting-heatmap", "Posting heatmap")}
          onAddToDashboard={() => onAddToDashboard("posting-heatmap")}
          dragItem={fromCard({ cardType: "posting-heatmap", label: "Posting heatmap", query })}
        >
          <PostingHeatmapChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 9 */}
        <AnalyticsCardFrame
          label="Content length × engagement"
          meta="text length vs engagement score"
          onAddToContext={() => onAddToContext("content-length", "Content length × engagement")}
          onAddToDashboard={() => onAddToDashboard("content-length")}
          dragItem={fromCard({ cardType: "content-length", label: "Content length × engagement", query })}
        >
          <ContentLengthEngagementChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Author influence"
          meta="followers vs engagement rate"
          onAddToContext={() => onAddToContext("author-influence", "Author influence")}
          onAddToDashboard={() => onAddToDashboard("author-influence")}
          dragItem={fromCard({ cardType: "author-influence", label: "Author influence", query })}
        >
          <AuthorInfluenceScatterChart query={query} />
        </AnalyticsCardFrame>
      </div>
    </>
  );
}
