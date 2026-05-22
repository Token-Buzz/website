"use client";

import { useAggregatePolling } from "./useAggregatePolling";
import { BarList } from "./BarList";

type Props = { query: string };

interface ApiItem {
  source: string;
  count: number;
}

export function SourceDistributionChart({ query }: Props) {
  const url = query
    ? `/api/analytics/source-distribution?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { items: rawItems, loading, error } = useAggregatePolling<ApiItem>(url);

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  const items = rawItems.map((d) => ({ label: d.source, value: d.count }));

  return (
    <BarList
      items={items}
      loading={loading}
      maxItems={10}
      emptyState="Source field not available from twitterapi.io"
    />
  );
}
