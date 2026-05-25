"use client";

import { useSummaryItems } from "./SummaryProvider";
import { BarList } from "./BarList";

type Props = { query: string };

export function SourceDistributionChart({ query: _query }: Props) {
  const { items: rawItems, loading, error } = useSummaryItems("sourceDistribution");

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
