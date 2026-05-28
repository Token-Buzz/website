"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { DashboardCard, DashboardCardType } from "@monorepo-template/core/db/dashboards";
import { Eyebrow, Icon } from "../_dashboard/primitives";
import { SearchBar } from "../_analytics/SearchBar";
import { useIsMobile } from "@/app/_hooks/useIsMobile";
import { SummaryProvider } from "../_analytics/SummaryProvider";
import { HistorySaver } from "../_analytics/HistorySaver";
import { AnalyticsChartGrid } from "../_analytics/AnalyticsChartGrid";
import { DashboardPickerModal } from "../dashboards/_components/DashboardPickerModal";
import { addHumContext, buildHumContextItem } from "../dashboards/_components/cardActions";

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

        <AnalyticsChartGrid
          query={query}
          isMobile={isMobile}
          onAddToContext={handleAddToContext}
          onAddToDashboard={handleAddToDashboard}
        />

        {/* ── Footer ────────────────────────────────────────────────────── */}
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
          cards={[pickerCard]}
          allowCreate
          createQuery={query}
          onClose={() => setPickerCard(null)}
          onAdded={({ name }) => {
            setPickerCard(null);
            setNotice('Added card to "' + name + '"');
          }}
        />
      )}
    </div>
  );
}
