"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useSummaryItems } from "./SummaryProvider";
import { StackedAreaSVG, type StackedAreaRow } from "./StackedAreaSVG";

type Props = { query: string };

const SERIES = [
  { key: "likes", label: "Likes", color: "#f97316" },
  { key: "retweets", label: "Retweets", color: "#3b82f6" },
  { key: "replies", label: "Replies", color: "#8b5cf6" },
  { key: "quotes", label: "Quotes", color: "#10b981" },
];

export function EngagementTimeSeriesChart({ query: _query }: Props) {
  const { items, loading, error } = useSummaryItems("engagementTimeseries");

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && items.length === 0) return <AnalyzingIndicator />;

  const rows: StackedAreaRow[] = items.map((r) => ({
    label: r.bucket,
    likes: r.likes,
    retweets: r.retweets,
    replies: r.replies,
    quotes: r.quotes,
  }));

  return <StackedAreaSVG rows={rows} series={SERIES} height={200} />;
}
