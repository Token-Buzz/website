"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useAggregatePolling } from "./useAggregatePolling";
import { StackedAreaSVG, type StackedAreaRow } from "./StackedAreaSVG";

type Props = { query: string };

interface ApiRow {
  bucket: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
}

const SERIES = [
  { key: "likes", label: "Likes", color: "#f97316" },
  { key: "retweets", label: "Retweets", color: "#3b82f6" },
  { key: "replies", label: "Replies", color: "#8b5cf6" },
  { key: "quotes", label: "Quotes", color: "#10b981" },
];

export function EngagementTimeSeriesChart({ query }: Props) {
  const url = query
    ? `/api/analytics/engagement-timeseries?query=${encodeURIComponent(query)}&window=24H`
    : null;

  const { items, loading, error } = useAggregatePolling<ApiRow>(url);

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
