"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";
import { BarList } from "./BarList";

type Props = { query: string };

interface ApiResponse {
  low: number;
  mid: number;
  high: number;
}

// The author-influence endpoint returns a follower-tier histogram, not individual
// scatter points. We render it as a labelled bar list with descriptive tier names.
export function AuthorInfluenceScatterChart({ query }: Props) {
  const url = query
    ? `/api/analytics/author-influence?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url, {
    isPopulated: (d) => d.low + d.mid + d.high > 0,
  });

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const counts = {
    low: data?.low ?? 0,
    mid: data?.mid ?? 0,
    high: data?.high ?? 0,
  };
  const total = counts.low + counts.mid + counts.high;

  const items = [
    { label: "High (>100k)", value: counts.high, rank: 1 },
    { label: "Mid (1k–100k)", value: counts.mid, rank: 2 },
    { label: "Low (<1k)", value: counts.low, rank: 3 },
  ];

  return (
    <div>
      <BarList items={items} loading={loading && total === 0} maxItems={3} />
      {total > 0 && (
        <div
          style={{
            marginTop: 8,
            font: "500 10px var(--font-mono)",
            color: "var(--fg-4)",
          }}
        >
          {total.toLocaleString()} authors · bucketed by follower count
        </div>
      )}
    </div>
  );
}
