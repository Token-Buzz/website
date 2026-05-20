"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useAggregatePolling } from "./useAggregatePolling";
import { StackedAreaSVG, type StackedAreaRow } from "./StackedAreaSVG";

type Props = { query: string };

interface ApiRow {
  bucket: string;
  positive: number;
  neutral: number;
  negative: number;
}

const SERIES = [
  { key: "positive", label: "Bull", color: "#22c55e" },
  { key: "neutral", label: "Mixed", color: "#f59e0b" },
  { key: "negative", label: "Bear", color: "#ef4444" },
];

export function SentimentTimelineChart({ query }: Props) {
  // Polls independently of the page-level sentiment pending state
  const url = query
    ? `/api/analytics/sentiment-by-query?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { items, loading, error } = useAggregatePolling<ApiRow>(url);

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
