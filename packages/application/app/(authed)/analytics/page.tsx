"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { DashboardCard, DashboardCardType } from "@monorepo-template/core/db/dashboards";
import { Card, SectionHead, Eyebrow, Icon } from "../_dashboard/primitives";
import { SearchBar } from "../_analytics/SearchBar";
import { ChartErrorBoundary } from "../_analytics/ChartErrorBoundary";
import { AnalyticsCardFrame } from "../_analytics/AnalyticsCardFrame";
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
import { SummaryProvider } from "../_analytics/SummaryProvider";
import { HistorySaver } from "../_analytics/HistorySaver";
import { DashboardPickerModal } from "../dashboards/_components/DashboardPickerModal";
import { addHumContext, buildHumContextItem } from "../dashboards/_components/cardActions";
import { fromCard } from "../_dashboard/humContext";

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

  const [pickerCard, setPickerCard] = useState<DashboardCard | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submission, setSubmission] = useState<{ query: string; id: string } | null>(null);

  // Auto-dismiss notice after 4000ms
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function handleAddToContext(cardType: DashboardCardType, label: string) {
    addHumContext(buildHumContextItem({ cardType, label, query, source: "analytics-card" }));
    setNotice('Added "' + label + '" to Hum context');
  }

  function handleAddToDashboard(cardType: DashboardCardType) {
    setPickerCard({
      id: crypto.randomUUID(),
      type: cardType,
      position: { x: 0, y: 0, w: 6, h: 9 },
      options: {},
    });
  }

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
        <SearchBar onIngested={(q) => setSubmission({ query: q, id: crypto.randomUUID() })} />
      </div>

      {/* ── Notice banner ───────────────────────────────────────────────── */}
      {notice && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--buzz-500)",
            borderRadius: 6,
            font: "500 13px/1.4 var(--font-sans)",
            color: "var(--fg-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "inherit",
              padding: 2,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* ── Summary data provider — one request for all charts ─────────── */}
      <SummaryProvider query={query}>
        <HistorySaver submission={submission} />

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
        <AnalyticsCardFrame
          label="Top hashtags"
          meta="last 24h"
          onAddToContext={() => handleAddToContext("hashtags", "Top hashtags")}
          onAddToDashboard={() => handleAddToDashboard("hashtags")}
          dragItem={fromCard({ cardType: "hashtags", label: "Top hashtags", query })}
        >
          <TopHashtagsChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Top mentions"
          meta="last 24h · by reach"
          onAddToContext={() => handleAddToContext("mentions", "Top mentions")}
          onAddToDashboard={() => handleAddToDashboard("mentions")}
          dragItem={fromCard({ cardType: "mentions", label: "Top mentions", query })}
        >
          <TopMentionsChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 2 */}
        <AnalyticsCardFrame
          label="Domain distribution"
          meta="tweet URLs"
          onAddToContext={() => handleAddToContext("domains", "Domain distribution")}
          onAddToDashboard={() => handleAddToDashboard("domains")}
          dragItem={fromCard({ cardType: "domains", label: "Domain distribution", query })}
        >
          <DomainDistributionChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Bio domains"
          meta="author bio links"
          onAddToContext={() => handleAddToContext("bio-domains", "Bio domains")}
          onAddToDashboard={() => handleAddToDashboard("bio-domains")}
          dragItem={fromCard({ cardType: "bio-domains", label: "Bio domains", query })}
        >
          <BioDomainsChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 3 */}
        <AnalyticsCardFrame
          label="Symbol rate"
          meta="tweets / hour"
          onAddToContext={() => handleAddToContext("symbol-rate", "Symbol rate")}
          onAddToDashboard={() => handleAddToDashboard("symbol-rate")}
          dragItem={fromCard({ cardType: "symbol-rate", label: "Symbol rate", query })}
        >
          <SymbolRateChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Engagement timeseries"
          meta="likes · RT · replies · quotes"
          onAddToContext={() => handleAddToContext("engagement", "Engagement timeseries")}
          onAddToDashboard={() => handleAddToDashboard("engagement")}
          dragItem={fromCard({ cardType: "engagement", label: "Engagement timeseries", query })}
        >
          <EngagementTimeSeriesChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 4 — sentiment */}
        <AnalyticsCardFrame
          label="Sentiment gauge"
          meta="avg score · 7D"
          onAddToContext={() => handleAddToContext("sentiment", "Sentiment gauge")}
          onAddToDashboard={() => handleAddToDashboard("sentiment")}
          dragItem={fromCard({ cardType: "sentiment", label: "Sentiment gauge", query })}
        >
          <SentimentGaugeChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Sentiment timeline"
          meta="% bull / bear / mixed"
          onAddToContext={() => handleAddToContext("sentiment-timeline", "Sentiment timeline")}
          onAddToDashboard={() => handleAddToDashboard("sentiment-timeline")}
          dragItem={fromCard({ cardType: "sentiment-timeline", label: "Sentiment timeline", query })}
        >
          <SentimentTimelineChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 5 */}
        <AnalyticsCardFrame
          label="Keyword word cloud"
          meta="top extracted terms"
          onAddToContext={() => handleAddToContext("keywords", "Keyword word cloud")}
          onAddToDashboard={() => handleAddToDashboard("keywords")}
          dragItem={fromCard({ cardType: "keywords", label: "Keyword word cloud", query })}
        >
          <KeywordWordCloudChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Conversation depth"
          meta="thread reply depth"
          onAddToContext={() => handleAddToContext("conversation-depth", "Conversation depth")}
          onAddToDashboard={() => handleAddToDashboard("conversation-depth")}
          dragItem={fromCard({ cardType: "conversation-depth", label: "Conversation depth", query })}
        >
          <ConversationDepthChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 6 */}
        <AnalyticsCardFrame
          label="Geographic distribution"
          meta="author locations · top 15"
          onAddToContext={() => handleAddToContext("geo", "Geographic distribution")}
          onAddToDashboard={() => handleAddToDashboard("geo")}
          dragItem={fromCard({ cardType: "geo", label: "Geographic distribution", query })}
        >
          <GeographicDistributionMapChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Language distribution"
          meta="tweet language"
          onAddToContext={() => handleAddToContext("languages", "Language distribution")}
          onAddToDashboard={() => handleAddToDashboard("languages")}
          dragItem={fromCard({ cardType: "languages", label: "Language distribution", query })}
        >
          <LanguageDistributionChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 7 */}
        <AnalyticsCardFrame
          label="Source distribution"
          meta="Twitter client"
          onAddToContext={() => handleAddToContext("sources", "Source distribution")}
          onAddToDashboard={() => handleAddToDashboard("sources")}
          dragItem={fromCard({ cardType: "sources", label: "Source distribution", query })}
        >
          <SourceDistributionChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Verification breakdown"
          meta="blue · business · government"
          onAddToContext={() => handleAddToContext("verification", "Verification breakdown")}
          onAddToDashboard={() => handleAddToDashboard("verification")}
          dragItem={fromCard({ cardType: "verification", label: "Verification breakdown", query })}
        >
          <VerificationBreakdownChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 8 */}
        <AnalyticsCardFrame
          label="Bot ratio"
          meta="automated vs human"
          onAddToContext={() => handleAddToContext("bot-ratio", "Bot ratio")}
          onAddToDashboard={() => handleAddToDashboard("bot-ratio")}
          dragItem={fromCard({ cardType: "bot-ratio", label: "Bot ratio", query })}
        >
          <BotRatioChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Posting heatmap"
          meta="day × hour · 7D"
          onAddToContext={() => handleAddToContext("posting-heatmap", "Posting heatmap")}
          onAddToDashboard={() => handleAddToDashboard("posting-heatmap")}
          dragItem={fromCard({ cardType: "posting-heatmap", label: "Posting heatmap", query })}
        >
          <PostingHeatmapChart query={query} />
        </AnalyticsCardFrame>

        {/* Row 9 */}
        <AnalyticsCardFrame
          label="Content length × engagement"
          meta="text length vs engagement score"
          onAddToContext={() => handleAddToContext("content-length", "Content length × engagement")}
          onAddToDashboard={() => handleAddToDashboard("content-length")}
          dragItem={fromCard({ cardType: "content-length", label: "Content length × engagement", query })}
        >
          <ContentLengthEngagementChart query={query} />
        </AnalyticsCardFrame>
        <AnalyticsCardFrame
          label="Author influence"
          meta="followers vs engagement rate"
          onAddToContext={() => handleAddToContext("author-influence", "Author influence")}
          onAddToDashboard={() => handleAddToDashboard("author-influence")}
          dragItem={fromCard({ cardType: "author-influence", label: "Author influence", query })}
        >
          <AuthorInfluenceScatterChart query={query} />
        </AnalyticsCardFrame>
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

      </SummaryProvider>

      {/* Picker modal — "Add to dashboard" */}
      {pickerCard && (
        <DashboardPickerModal
          card={pickerCard}
          currentDashboardId=""
          onClose={() => setPickerCard(null)}
          onAdded={(name) => {
            setPickerCard(null);
            setNotice('Added card to "' + name + '"');
          }}
        />
      )}
    </div>
  );
}
