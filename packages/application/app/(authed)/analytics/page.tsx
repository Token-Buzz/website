"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, SectionHead, Eyebrow } from "../_dashboard/primitives";
import { SearchBar } from "../_analytics/SearchBar";

// ── Sentiment polling config ───────────────────────────────────────────────

const SENTIMENT_TIMEOUT_MS = 30_000;
const BACKOFF_SCHEDULE_MS = [1_000, 2_000, 4_000, 8_000, 8_000, 8_000];

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

// ── Analyzing-sentiment indicator ─────────────────────────────────────────

function AnalyzingSentiment() {
  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "20px 0",
        font: "500 12px var(--font-mono)",
        color: "var(--fg-3)",
      }}
    >
      {/* Animated dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--buzz-500)",
          display: "inline-block",
          animation: "tb-pulse 1.8s cubic-bezier(0.3,1.4,0.4,1) infinite",
          boxShadow: "0 0 0 3px rgba(255,107,44,0.22)",
          flexShrink: 0,
        }}
      />
      Analyzing sentiment…
    </div>
  );
}

// ── Grid chart card ────────────────────────────────────────────────────────

interface ChartCardProps {
  eyebrow: string;
  meta?: string;
  sentimentPending?: boolean;
}

function ChartCard({ eyebrow, meta, sentimentPending }: ChartCardProps) {
  return (
    <Card padding={20} style={{ display: "flex", flexDirection: "column" }}>
      <SectionHead eyebrow={eyebrow} meta={meta} />
      {sentimentPending ? <AnalyzingSentiment /> : <ComingSoon />}
    </Card>
  );
}

// ── Tweet results placeholder ──────────────────────────────────────────────

function TweetResultsPlaceholder({ query }: { query: string }) {
  if (!query) return null;
  return (
    <Card padding={20}>
      <SectionHead eyebrow="Tweet results" meta={`query: ${query}`} />
      <div
        style={{
          marginTop: 12,
          padding: "20px",
          textAlign: "center",
          font: "500 11px var(--font-mono)",
          color: "var(--fg-4)",
          border: "1px dashed var(--border)",
          borderRadius: 6,
        }}
      >
        Tweet results table — Coming in v1.1
      </div>
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

  // Sentiment polling state
  const [sentimentWaitUntil, setSentimentWaitUntil] = useState<number | null>(null);
  const sentimentPending = sentimentWaitUntil !== null;

  // Start sentiment polling after a successful ingest
  const handleIngested = useCallback((q: string) => {
    const deadline = Date.now() + SENTIMENT_TIMEOUT_MS;
    setSentimentWaitUntil(deadline);

    let attemptIndex = 0;

    async function poll() {
      if (Date.now() > deadline) {
        // Timed out — give up
        setSentimentWaitUntil(null);
        return;
      }

      const delay = BACKOFF_SCHEDULE_MS[attemptIndex] ?? 8_000;
      attemptIndex++;

      await new Promise<void>((resolve) => setTimeout(resolve, delay));

      // Check deadline again after the delay
      if (Date.now() > deadline) {
        setSentimentWaitUntil(null);
        return;
      }

      try {
        const res = await fetch(
          `/api/analytics/sentiment-by-query?query=${encodeURIComponent(q)}&window=7D`,
        );
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : [];
          if (items.length > 0) {
            // Sentiment data is ready — stop polling
            setSentimentWaitUntil(null);
            return;
          }
        }
      } catch {
        // swallow — will retry on schedule
      }

      // Still no data; schedule next attempt if we still have time
      if (Date.now() < deadline) {
        void poll();
      } else {
        setSentimentWaitUntil(null);
      }
    }

    void poll();
  }, []);

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
        <SearchBar onIngested={handleIngested} />
      </div>

      {/* ── Tweet results (Phase 6) ──────────────────────────────────────── */}
      {query && <TweetResultsPlaceholder query={query} />}

      {/* ── Chart grid ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Row 1 */}
        <ChartCard eyebrow="Top hashtags" meta="last 24h" />
        <ChartCard eyebrow="Top mentions" meta="last 24h · by reach" />

        {/* Row 2 */}
        <ChartCard eyebrow="Domain distribution" meta="tweet URLs" />
        <ChartCard eyebrow="Bio domains" meta="author bio links" />

        {/* Row 3 */}
        <ChartCard eyebrow="Symbol rate" meta="tweets / hour" />
        <ChartCard eyebrow="Engagement timeseries" meta="likes · RT · replies · quotes" />

        {/* Row 4 — sentiment cards */}
        <ChartCard
          eyebrow="Sentiment gauge"
          meta="avg score"
          sentimentPending={sentimentPending}
        />
        <ChartCard
          eyebrow="Sentiment timeline"
          meta="% bull / bear / mixed"
          sentimentPending={sentimentPending}
        />

        {/* Row 5 */}
        <ChartCard eyebrow="Keyword word cloud" meta="top extracted terms" />
        <ChartCard eyebrow="Conversation depth" meta="thread reply depth" />

        {/* Row 6 */}
        <ChartCard eyebrow="Geographic distribution" meta="author locations" />
        <ChartCard eyebrow="Language distribution" meta="tweet language" />

        {/* Row 7 */}
        <ChartCard eyebrow="Source distribution" meta="Twitter client" />
        <ChartCard eyebrow="Verification breakdown" meta="blue · business · government" />

        {/* Row 8 */}
        <ChartCard eyebrow="Bot ratio" meta="automated vs human" />
        <ChartCard eyebrow="Posting heatmap" meta="day × hour" />

        {/* Row 9 */}
        <ChartCard
          eyebrow="Content length × engagement"
          meta="text length vs engagement score"
        />
        <ChartCard
          eyebrow="Author influence"
          meta="followers vs engagement rate"
        />
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
