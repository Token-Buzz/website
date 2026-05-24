"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, SectionHead, Eyebrow } from "../_dashboard/primitives";
import { SearchBar } from "../_analytics/SearchBar";
import { ChartErrorBoundary } from "../_analytics/ChartErrorBoundary";
import { useIsMobile } from "@/app/_hooks/useIsMobile";
import { TopHashtagsChart } from "../_analytics/TopHashtagsChart";
import { TopMentionsChart } from "../_analytics/TopMentionsChart";
import { DomainDistributionChart } from "../_analytics/DomainDistributionChart";
import { BioDomainsChart } from "../_analytics/BioDomainsChart";
import { LanguageDistributionChart } from "../_analytics/LanguageDistributionChart";
import { SourceDistributionChart } from "../_analytics/SourceDistributionChart";
import { TweetsResultsTable } from "../_analytics/TweetsResultsTable";
import { SymbolRateChart } from "../_analytics/SymbolRateChart";
import { EngagementTimeSeriesChart } from "../_analytics/EngagementTimeSeriesChart";
import { SentimentTimelineChart } from "../_analytics/SentimentTimelineChart";
import { ConversationDepthChart } from "../_analytics/ConversationDepthChart";
import { VerificationBreakdownChart } from "../_analytics/VerificationBreakdownChart";
import { BotRatioChart } from "../_analytics/BotRatioChart";
import { KeywordWordCloudChart } from "../_analytics/KeywordWordCloudChart";
import { AuthorInfluenceScatterChart } from "../_analytics/AuthorInfluenceScatterChart";
import { SentimentGaugeChart } from "../_analytics/SentimentGaugeChart";
import { PostingHeatmapChart } from "../_analytics/PostingHeatmapChart";
import { GeographicDistributionMapChart } from "../_analytics/GeographicDistributionMapChart";
import { ContentLengthEngagementChart } from "../_analytics/ContentLengthEngagementChart";

// ── Analytics page ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPageInner />
    </Suspense>
  );
}

function AnalyticsPageInner() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        padding: isMobile ? "16px 12px" : "24px",
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? 16 : 24,
        maxWidth: 1480,
        margin: "0 auto",
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Analytics</Eyebrow>
        <h1
          style={{
            font: `600 ${isMobile ? "22px" : "28px"}/1.15 var(--font-sans)`,
            letterSpacing: "-0.015em",
            color: "var(--fg-1)",
            margin: "0 0 20px",
          }}
        >
          Social analytics
        </h1>

        {/* Search bar */}
        <SearchBar onIngested={() => {}} />
      </div>

      {/* ── Tweet results ───────────────────────────────────────────────── */}
      {query && (
        <Card padding={20}>
          <SectionHead eyebrow="Tweet results" meta={`query: ${query}`} />
          <ChartErrorBoundary chartName="Tweet results">
            <TweetsResultsTable query={query} />
          </ChartErrorBoundary>
        </Card>
      )}

      {/* ── Chart grid ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 12 : 16,
        }}
      >
        {/* Row 1 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Top hashtags" meta="last 24h" />
          <ChartErrorBoundary chartName="Top hashtags">
            <TopHashtagsChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Top mentions" meta="last 24h · by reach" />
          <ChartErrorBoundary chartName="Top mentions">
            <TopMentionsChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 2 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Domain distribution" meta="tweet URLs" />
          <ChartErrorBoundary chartName="Domain distribution">
            <DomainDistributionChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Bio domains" meta="author bio links" />
          <ChartErrorBoundary chartName="Bio domains">
            <BioDomainsChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 3 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Symbol rate" meta="tweets / hour" />
          <ChartErrorBoundary chartName="Symbol rate">
            <SymbolRateChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Engagement timeseries" meta="likes · RT · replies · quotes" />
          <ChartErrorBoundary chartName="Engagement timeseries">
            <EngagementTimeSeriesChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 4 — sentiment */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Sentiment gauge" meta="avg score · 7D" />
          <ChartErrorBoundary chartName="Sentiment gauge">
            <SentimentGaugeChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Sentiment timeline" meta="% bull / bear / mixed" />
          <ChartErrorBoundary chartName="Sentiment timeline">
            <SentimentTimelineChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 5 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Keyword word cloud" meta="top extracted terms" />
          <ChartErrorBoundary chartName="Keyword word cloud">
            <KeywordWordCloudChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Conversation depth" meta="thread reply depth" />
          <ChartErrorBoundary chartName="Conversation depth">
            <ConversationDepthChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 6 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Geographic distribution" meta="author locations · top 15" />
          <ChartErrorBoundary chartName="Geographic distribution">
            <GeographicDistributionMapChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Language distribution" meta="tweet language" />
          <ChartErrorBoundary chartName="Language distribution">
            <LanguageDistributionChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 7 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Source distribution" meta="Twitter client" />
          <ChartErrorBoundary chartName="Source distribution">
            <SourceDistributionChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Verification breakdown" meta="blue · business · government" />
          <ChartErrorBoundary chartName="Verification breakdown">
            <VerificationBreakdownChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 8 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Bot ratio" meta="automated vs human" />
          <ChartErrorBoundary chartName="Bot ratio">
            <BotRatioChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Posting heatmap" meta="day × hour · 7D" />
          <ChartErrorBoundary chartName="Posting heatmap">
            <PostingHeatmapChart query={query} />
          </ChartErrorBoundary>
        </Card>

        {/* Row 9 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Content length × engagement" meta="text length vs engagement score" />
          <ChartErrorBoundary chartName="Content length × engagement">
            <ContentLengthEngagementChart query={query} />
          </ChartErrorBoundary>
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Author influence" meta="followers vs engagement rate" />
          <ChartErrorBoundary chartName="Author influence">
            <AuthorInfluenceScatterChart query={query} />
          </ChartErrorBoundary>
        </Card>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          font: "500 11px var(--font-mono)",
          color: "var(--fg-4)",
          letterSpacing: "0.04em",
        }}
      >
        Analytics powered by TokenBuzz · charts load after you submit a query
      </div>
    </div>
  );
}
