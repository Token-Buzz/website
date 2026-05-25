"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useSummaryItems } from "./SummaryProvider";
import { StackedAreaSVG, type StackedAreaRow } from "./StackedAreaSVG";

type Props = { query: string };

const SERIES = [
  { key: "positive", label: "Bull", color: "#22c55e" },
  { key: "neutral", label: "Mixed", color: "#f59e0b" },
  { key: "negative", label: "Bear", color: "#ef4444" },
];

export function SentimentTimelineChart({ query: _query }: Props) {
  const { items, loading, error } = useSummaryItems("sentimentByQuery");

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && items.length === 0) return <AnalyzingIndicator />;

  const rows: StackedAreaRow[] = items.map((r) => ({
    label: r.bucket,
    positive: r.positive,
    neutral: r.neutral,
    negative: r.negative,
  }));

  return <StackedAreaSVG rows={rows} series={SERIES} height={200} percentMode />;
}
