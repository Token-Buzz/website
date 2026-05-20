"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, SectionHead, Eyebrow } from "../_dashboard/primitives";
import { SearchBar } from "../_analytics/SearchBar";
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

// ── Coming-soon placeholder ────────────────────────────────────────────────

function ComingSoon() {
  return (
    <div
      style={{
        marginTop: 16,
        padding: "24px 0",
        textAlign: "center",
        font: "500 11px var(--font-mono)",
        color: "var(--fg-4)",
        border: "1px dashed var(--border)",
        borderRadius: 6,
      }}
    >
      Coming in v1.1
    </div>
  );
}

// ── Grid chart card (coming-soon only) ────────────────────────────────────

interface ChartCardProps {
  eyebrow: string;
  meta?: string;
}

function ChartCard({ eyebrow, meta }: ChartCardProps) {
  return (
    <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
      <SectionHead eyebrow={eyebrow} meta={meta} />
      <ComingSoon />
    </Card>
  );
}

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

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1480,
        margin: "0 auto",
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Analytics</Eyebrow>
        <h1
          style={{
            font: "600 28px/1.15 var(--font-sans)",
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
          <TweetsResultsTable query={query} />
        </Card>
      )}

      {/* ── Chart grid ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Row 1 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Top hashtags" meta="last 24h" />
          <TopHashtagsChart query={query} />
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Top mentions" meta="last 24h · by reach" />
          <TopMentionsChart query={query} />
        </Card>

        {/* Row 2 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Domain distribution" meta="tweet URLs" />
          <DomainDistributionChart query={query} />
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Bio domains" meta="author bio links" />
          <BioDomainsChart query={query} />
        </Card>

        {/* Row 3 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Symbol rate" meta="tweets / hour" />
          <SymbolRateChart query={query} />
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Engagement timeseries" meta="likes · RT · replies · quotes" />
          <EngagementTimeSeriesChart query={query} />
        </Card>

        {/* Row 4 — sentiment */}
        <ChartCard eyebrow="Sentiment gauge" meta="avg score" />
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Sentiment timeline" meta="% bull / bear / mixed" />
          <SentimentTimelineChart query={query} />
        </Card>

        {/* Row 5 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Keyword word cloud" meta="top extracted terms" />
          <KeywordWordCloudChart query={query} />
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Conversation depth" meta="thread reply depth" />
          <ConversationDepthChart query={query} />
        </Card>

        {/* Row 6 */}
        <ChartCard eyebrow="Geographic distribution" meta="author locations" />
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Language distribution" meta="tweet language" />
          <LanguageDistributionChart query={query} />
        </Card>

        {/* Row 7 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Source distribution" meta="Twitter client" />
          <SourceDistributionChart query={query} />
        </Card>
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Verification breakdown" meta="blue · business · government" />
          <VerificationBreakdownChart query={query} />
        </Card>

        {/* Row 8 */}
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Bot ratio" meta="automated vs human" />
          <BotRatioChart query={query} />
        </Card>
        <ChartCard eyebrow="Posting heatmap" meta="day × hour" />

        {/* Row 9 */}
        <ChartCard
          eyebrow="Content length × engagement"
          meta="text length vs engagement score"
        />
        <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead eyebrow="Author influence" meta="followers vs engagement rate" />
          <AuthorInfluenceScatterChart query={query} />
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
